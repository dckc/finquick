;; amazon-match-lib.scm
;; Match uncategorized Amazon charges to Amazon orders by process of
;; elimination; a port of qtrx tools/amazon_match.py.
;;
;; Pure: no GnuCash, so `make test` runs it with plain guile. Each
;; charge carries an opaque handle (a split, in GnuCash) that this
;; module passes along but never uses; the menu item in
;; amazon-match.scm sets memos on the handles of what matched.
;;
;; Money is exact: (money "95.87") is 9587/100. Dates are "YYYY-MM-DD".
;;
;; Copyright (C) 2026 by Dan Connolly
;; SPDX-License-Identifier: Apache-2.0

(define-module (amazon-match-lib))
(use-modules ((srfi srfi-1) #:select (any append-map delete-duplicates filter-map list-index)))
(use-modules ((srfi srfi-9) #:select (define-record-type)))
(use-modules ((srfi srfi-11) #:select (let-values)))

(export make-order order-id order-date order-total order-items
        make-charge charge-key charge-date charge-amount charge-description charge-handle
        make-policy default-policy window-rule
        candidate-order-id candidate-keys
        outcome-matched outcome-ambiguous outcome-unmatched
        money parse-orders uncategorized-amazon? earliest-order-date
        candidates eliminate unique-per-charge outcome-of disagreements
        compare memos report)

(define-record-type <order>
  (make-order id date total items)
  order?
  (id order-id)
  (date order-date)
  (total order-total)   ; exact, or #f: no amount to match
  (items order-items))

(define-record-type <charge>
  (make-charge key date amount description handle)
  charge?
  (key charge-key)               ; split guid
  (date charge-date)
  (amount charge-amount)         ; exact
  (description charge-description)
  (handle charge-handle))        ; opaque here

;; which (order, charges) pairs are candidates at all
(define-record-type <policy>
  (make-policy min-days max-days max-pieces max-spread)
  policy?
  (min-days policy-min-days)     ; charge this many days after the order, or more
  (max-days policy-max-days)     ; ... and no more than this
  (max-pieces policy-max-pieces) ; charges for one order shipped in pieces
  (max-spread policy-max-spread)) ; days between the first and last piece

(define default-policy (make-policy 0 30 3 3))
;; the old rule (qtrx amazon-matching.sql): one charge, 0-7 days after
(define window-rule (make-policy 0 7 1 0))

(define-record-type <candidate>
  (make-candidate order-id charges)
  candidate?
  (order-id candidate-order-id)
  (charges candidate-charges))   ; sorted by key

(define (candidate-keys cand) (map charge-key (candidate-charges cand)))

(define-record-type <outcome>
  (make-outcome matched ambiguous unmatched)
  outcome?
  (matched outcome-matched)      ; ((key . order-id) ...), sorted by key
  (ambiguous outcome-ambiguous)  ; (key ...), sorted
  (unmatched outcome-unmatched)) ; (key ...), sorted

;;; parsing

(define (money text)
  "exact dollars, or #f for \"0\", \"1Audiblecredit\", etc."
  (let ((n (string->number (string-append "#e" text))))
    (and n (rational? n) (not (zero? n)) n)))

(define (csv-fields line)
  "fields of one CSV line; a quoted field may hold commas, and \"\" for \""
  (let ((n (string-length line)))
    (let loop ((i 0) (field '()) (fields '()) (quoted #f))
      (define (done-field) (cons (list->string (reverse field)) fields))
      (if (= i n)
          (reverse (done-field))
          (let ((c (string-ref line i)))
            (cond
             ((and quoted (char=? c #\") (< (+ i 1) n) (char=? (string-ref line (+ i 1)) #\"))
              (loop (+ i 2) (cons #\" field) fields #t))
             ((char=? c #\") (loop (+ i 1) field fields (not quoted)))
             ((and (not quoted) (char=? c #\,)) (loop (+ i 1) '() (done-field) #f))
             (else (loop (+ i 1) (cons c field) fields quoted))))))))

(define (parse-orders lines)
  "orders from azad's CSV, which may start with a BOM and repeats its header"
  (let* ((first (car lines))
         (header (csv-fields (if (string-prefix? "\ufeff" first) (substring first 1) first)))
         (col (lambda (name)
                (or (list-index (lambda (h) (string=? h name)) header)
                    (error "amazon order history: no column" name)))))
    (let ((id (col "order id")) (date (col "date")) (total (col "total")) (items (col "items")))
      (filter-map (lambda (line)
                    (let ((row (csv-fields line)))
                      (and (> (length row) items)
                           (not (string=? (list-ref row id) "order id"))
                           (make-order (list-ref row id) (list-ref row date)
                                       (money (list-ref row total)) (list-ref row items)))))
                  (cdr lines)))))

(define (uncategorized-amazon? description memo date start)
  "Is a split with these an uncategorized Amazon charge, on or after start?
(The caller looks only at the Imbalance account's splits.)"
  (let ((desc (string-upcase description)))
    (and (string-null? memo)
         (not (string<? date start))
         (any (lambda (word) (string-contains desc word)) '("AMAZON" "AMZN")))))

(define (earliest-order-date orders)
  (car (sort (map order-date orders) string<?)))

;;; dates

(define (day-number date)
  "days since 1970-01-01 of \"YYYY-MM-DD\" (Hinnant's days_from_civil)"
  (let* ((y0 (string->number (substring date 0 4)))
         (m (string->number (substring date 5 7)))
         (d (string->number (substring date 8 10)))
         (y (if (<= m 2) (- y0 1) y0))
         (era (floor-quotient y 400))
         (yoe (- y (* era 400)))
         (doy (+ (quotient (+ (* 153 (+ m (if (> m 2) -3 9))) 2) 5) (- d 1)))
         (doe (+ (* yoe 365) (quotient yoe 4) (- (quotient yoe 100)) doy)))
    (+ (* era 146097) doe -719468)))

(define (days-after earlier later) (- (day-number later) (day-number earlier)))

;;; candidates

(define (combinations items k)
  (cond ((= k 0) '(()))
        ((null? items) '())
        (else (append (map (lambda (rest) (cons (car items) rest))
                           (combinations (cdr items) (- k 1)))
                      (combinations (cdr items) k)))))

(define (charge<? a b) (string<? (charge-key a) (charge-key b)))

(define (candidates policy orders charges)
  "each way 1..max-pieces charges could add up to an order's total"
  (append-map
   (lambda (order)
     (let* ((total (order-total order))
            (near (filter-map
                   (lambda (c)
                     (let ((days (days-after (order-date order) (charge-date c))))
                       (and (<= (policy-min-days policy) days (policy-max-days policy)) c)))
                   charges)))
       (if (not total)
           '()
           (append-map
            (lambda (k)
              (filter-map
               (lambda (combo)
                 (let ((days (map (lambda (c) (day-number (charge-date c))) combo)))
                   (and (<= (- (apply max days) (apply min days)) (policy-max-spread policy))
                        (= (apply + (map charge-amount combo)) total)
                        (make-candidate (order-id order) (sort combo charge<?)))))
               (combinations near k)))
            (iota (policy-max-pieces policy) 1)))))
   orders))

(define (by-charge pool)
  "key -> candidates using that charge"
  (let ((table (make-hash-table)))
    (for-each (lambda (cand)
                (for-each (lambda (key) (hash-set! table key (cons cand (hash-ref table key '()))))
                          (candidate-keys cand)))
              pool)
    table))

(define (sole-candidates pool)
  "candidates that are the only one for some charge, in a stable order"
  (define (sort-key cand) (string-join (cons (candidate-order-id cand) (candidate-keys cand)) " "))
  (sort (delete-duplicates
         (hash-fold (lambda (key cands acc) (if (= (length cands) 1) (cons (car cands) acc) acc))
                    '() (by-charge pool))
         eq?)
        (lambda (a b) (string<? (sort-key a) (sort-key b)))))

(define (unique-per-charge pool)
  "the old rule's reading: a charge with exactly one candidate matches it"
  (sole-candidates pool))

(define (without pool cand)
  "what's left once cand is matched: not its order, nor its charges"
  (let ((keys (candidate-keys cand)))
    (filter-map (lambda (other)
                  (and (not (string=? (candidate-order-id other) (candidate-order-id cand)))
                       (not (any (lambda (k) (member k keys)) (candidate-keys other)))
                       other))
                pool)))

(define (eliminate pool)
  "(values matched left), assuming each charge's order is among the orders
and each order is charged once, whole or in pieces.

A charge with one candidate must be that one; matching it rules out its
order's other candidates and any others using its charges; repeat. An
order with one candidate proves nothing: it may have been paid some
other way, or its charge already categorized.

One at a time, since two sole candidates can conflict; a charge left
with no candidate breaks the assumption, so it's reported on
current-error-port."
  (let loop ((pool pool) (matched '()))
    (let ((sole (sole-candidates pool)))
      (if (null? sole)
          (values (reverse matched) pool)
          (let* ((cand (car sole))
                 (left (without pool cand))
                 (still (by-charge left)))
            (hash-for-each
             (lambda (key cands)
               (unless (or (member key (candidate-keys cand)) (hash-ref still key))
                 (format (current-error-port)
                         "amazon-match: charge ~a has no candidate left once order ~a is matched~%"
                         key (candidate-order-id cand))))
             (by-charge pool))
            (loop left (cons cand matched)))))))

;;; outcomes

(define* (outcome-of charges matches #:optional (left '()))
  (let* ((matched (sort (delete-duplicates
                         (append-map (lambda (cand)
                                       (map (lambda (key) (cons key (candidate-order-id cand)))
                                            (candidate-keys cand)))
                                     matches))
                        (lambda (a b) (string<? (car a) (car b)))))
         (matched? (lambda (key) (assoc key matched)))
         (ambiguous (sort (filter-map (lambda (key) (and (not (matched? key)) key))
                                      (hash-map->list (lambda (key cands) key) (by-charge left)))
                          string<?))
         (unmatched (sort (filter-map (lambda (c)
                                        (let ((key (charge-key c)))
                                          (and (not (matched? key)) (not (member key ambiguous)) key)))
                                      charges)
                          string<?)))
    (make-outcome matched ambiguous unmatched)))

(define (disagreements a b)
  "keys both outcomes matched, but to different orders"
  (filter-map (lambda (pr)
                (let ((other (assoc (car pr) (outcome-matched b))))
                  (and other (not (string=? (cdr pr) (cdr other))) (car pr))))
              (outcome-matched a)))

(define (compare orders charges)
  "(values by-window by-elimination)"
  (let ((window-pool (candidates window-rule orders charges)))
    (let-values (((matched left) (eliminate (candidates default-policy orders charges))))
      (values (outcome-of charges (unique-per-charge window-pool) window-pool)
              (outcome-of charges matched left)))))

;;; memos and report

(define (json-string s)
  (string-append
   "\""
   (string-concatenate
    (map (lambda (c)
           (case c
             ((#\") "\\\"") ((#\\) "\\\\") ((#\newline) "\\n") ((#\return) "\\r") ((#\tab) "\\t")
             (else (if (< (char->integer c) 32)
                       (format #f "\\u~4,'0x" (char->integer c))
                       (string c)))))
         (string->list s)))
   "\""))

(define (memos orders outcome)
  "((key . memo) ...): each matched charge's order's items and id, as
amazon-matching.sql wrote them; each piece of a shipment gets its
order's memo"
  (map (lambda (pr)
         (let ((order (car (filter-map (lambda (o) (and (string=? (order-id o) (cdr pr)) o)) orders))))
           (cons (car pr)
                 (string-append "[" (json-string (order-items order))
                                ",{\"orderId\":" (json-string (order-id order)) "}]"))))
       (outcome-matched outcome)))

(define (dollars x) (format #f "~,2f" (exact->inexact x)))

(define (clip s n) (if (> (string-length s) n) (substring s 0 n) s))

(define (summary label outcome total)
  (format #f "~a: ~a of ~a matched, ~a ambiguous, ~a no candidate"
          label (length (outcome-matched outcome)) total
          (length (outcome-ambiguous outcome)) (length (outcome-unmatched outcome))))

(define (report orders charges by-window by-elimination)
  "lines of text"
  (define (charge-of key) (car (filter-map (lambda (c) (and (string=? (charge-key c) key) c)) charges)))
  (define (order-of id) (car (filter-map (lambda (o) (and (string=? (order-id o) id) o)) orders)))
  (define (by-date keys)
    (sort (map charge-of keys)
          (lambda (a b) (or (string<? (charge-date a) (charge-date b))
                            (and (string=? (charge-date a) (charge-date b)) (charge<? a b))))))
  (define (charge-line c)
    (format #f "~a ~a ~a" (charge-date c) (dollars (charge-amount c)) (clip (charge-description c) 40)))
  (let* ((n (length charges))
         (shipments (filter-map
                     (lambda (id)
                       (let ((keys (filter-map (lambda (pr) (and (string=? (cdr pr) id) (car pr)))
                                               (outcome-matched by-elimination))))
                         (and (> (length keys) 1) (cons id keys))))
                     (sort (delete-duplicates (map cdr (outcome-matched by-elimination))) string<?))))
    (append
     (list (summary "0-7 day window" by-window n)
           (summary "elimination   " by-elimination n)
           (format #f "the two disagree on ~a charges" (length (disagreements by-window by-elimination))))
     (append-map
      (lambda (shipment)
        (let ((o (order-of (car shipment))))
          (cons (format #f "shipped in ~a pieces: ~a ~a ~a" (length (cdr shipment)) (order-date o)
                        (dollars (order-total o))
                        (clip (string-trim-right (order-items o) (char-set #\; #\space)) 50))
                (map (lambda (c) (string-append "    " (charge-line c))) (by-date (cdr shipment))))))
      shipments)
     (map (lambda (c) (string-append "ambiguous: " (charge-line c))) (by-date (outcome-ambiguous by-elimination)))
     (map (lambda (c) (string-append "no candidate: " (charge-line c))) (by-date (outcome-unmatched by-elimination))))))
