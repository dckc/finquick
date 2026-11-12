;; amazon-match-test.scm -- run with: make test
;; The story from qtrx tools/amazon_match.py's doctests, told again.
(add-to-load-path (dirname (current-filename)))
(use-modules (srfi srfi-1) (srfi srfi-11) (srfi srfi-64) (amazon-match-lib))

;; Say amazon_order_history.csv has these orders (azad repeats its header at the end):
(define story-csv
  '("order id,order url,items,to,date,total,shipping,shipping_refund,gift,tax,refund,payments"
    "primer1,u,Face primer; ,Mary,2026-03-01,17.49,0,,,1.50,,"
    "primer2,u,Face primer; ,Mary,2026-03-20,17.49,0,,,1.50,,"
    "filter1,u,Air filter; ,Dan,2026-03-01,39.36,0,,,3.37,,"
    "filter2,u,Air filter; ,Dan,2026-03-02,39.36,0,,,3.37,,"
    "bidet,u,\"Bidet seat; CD, boxed; Toner; \",Dan,2026-06-02,121.01,0,,,23.83,,"
    "forms,u,Breast forms; ,Dan,2026-06-11,25.14,0,,,2.15,,"
    "D01-book,u,Bonhoeffer; ,DanAndMary,2026-06-12,1Audiblecredit,,,,,,"
    "order id,order url,items,to,date,total,shipping,shipping_refund,gift,tax,refund,payments"))

;; and the book has these splits (accounts by code; 9001 is Imbalance):
;;   split   date         account memo         amount  description
(define story-splits
  '(("x"      "2026-03-21" "9001" ""           "17.49" "AMAZON MKTPL*X1")
    ("y"      "2026-04-05" "9001" ""           "17.49" "AMAZON MKTPL*Y2")
    ("f1"     "2026-03-03" "9001" ""           "39.36" "AMAZON MKTPL*F3")
    ("f2"     "2026-03-04" "9001" ""           "39.36" "AMAZON MKTPL*F4")
    ("a"      "2026-06-05" "9001" ""           "95.87" "AMAZON MKTPL*A5")
    ("a-card" "2026-06-05" "2110" ""           "-95.87" "AMAZON MKTPL*A5")
    ("b"      "2026-06-05" "9001" ""           "25.14" "AMAZON MKTPL*B6")
    ("c"      "2026-06-12" "9001" ""           "25.14" "Amzn.com/bill")
    ("p"      "2026-06-20" "9001" ""           "14.99" "AMAZON PRIME*P8")
    ("n"      "2026-06-21" "9001" "[\"Towels\"]" "20.00" "AMAZON MKTPL*N9")
    ("k"      "2026-06-22" "9001" ""           "7.00"  "KROGER")
    ("old"    "2025-12-31" "9001" ""           "8.00"  "AMAZON MKTPL*OLD")))

(define story-orders (parse-orders story-csv))

;; what the menu item finds: the Imbalance account's uncategorized Amazon
;; charges since the first order (the handle stands in for the split)
(define story-charges
  (filter-map (lambda (row)
                (let-values (((key date account memo amount description) (apply values row)))
                  (and (string=? account "9001")
                       (uncategorized-amazon? description memo date (earliest-order-date story-orders))
                       (make-charge key date (money amount) description (list 'split key)))))
              story-splits))

(define (listed pool)
  (sort (map (lambda (cand) (cons (candidate-order-id cand) (candidate-keys cand))) pool)
        (lambda (a b) (string<? (string-join a " ") (string-join b " ")))))

(define (shown outcome)
  (list (outcome-matched outcome) (outcome-ambiguous outcome) (outcome-unmatched outcome)))

(test-begin "amazon-match")

(test-equal "money is exact, or #f when there's no amount to match"
  (list 9587/100 #f #f #f)
  (map money '("95.87" "0" "1Audiblecredit" "")))

(test-equal "parse-orders: a BOM, quoted commas, a repeated header, no amount"
  '(("primer1" "2026-03-01" 1749/100) ("primer2" "2026-03-20" 1749/100)
    ("filter1" "2026-03-01" 984/25) ("filter2" "2026-03-02" 984/25)
    ("bidet" "2026-06-02" 12101/100) ("forms" "2026-06-11" 1257/50)
    ("D01-book" "2026-06-12" #f))
  (map (lambda (o) (list (order-id o) (order-date o) (order-total o)))
       (parse-orders (cons (string-append "\ufeff" (car story-csv)) (cdr story-csv)))))

(test-equal "quoted items keep their comma"
  "Bidet seat; CD, boxed; Toner; "
  (order-items (list-ref story-orders 4)))

;; a-card isn't Imbalance, n has a memo, k isn't Amazon, and old is from last year
(test-equal "uncategorized Amazon charges"
  '("x" "y" "f1" "f2" "a" "b" "c" "p")
  (map charge-key story-charges))

;; y is 35 days after primer1: too late. b is before forms; c and a are a
;; week apart, so not one shipment. p adds up to nothing.
(test-equal "candidates"
  '(("bidet" "a" "b") ("filter1" "f1") ("filter1" "f2") ("filter2" "f1") ("filter2" "f2")
    ("forms" "c") ("primer1" "x") ("primer2" "x") ("primer2" "y"))
  (listed (candidates default-policy story-orders story-charges)))

;; y has only primer2, which leaves x only primer1; a, b, and c each have
;; one candidate; f1 and f2 have two each
(test-equal "eliminate: matched and left"
  '((("bidet" "a" "b") ("forms" "c") ("primer1" "x") ("primer2" "y"))
    (("filter1" "f1") ("filter1" "f2") ("filter2" "f1") ("filter2" "f2")))
  (let-values (((matched left) (eliminate (candidates default-policy story-orders story-charges))))
    (list (listed matched) (listed left))))

;; say gum was charged twice for one order: matching one strands the other
(test-equal "a stranded charge is unmatched"
  '((("g1" . "gum")) () ("g2"))
  (let ((orders (list (make-order "gum" "2026-03-15" 10 "Gum; ")))
        (charges (list (make-charge "g1" "2026-03-16" 10 "AMAZON g1" #f)
                       (make-charge "g2" "2026-03-17" 10 "AMAZON g2" #f))))
    (let-values (((matched left) (eliminate (candidates default-policy orders charges))))
      (shown (outcome-of charges matched left)))))

;; the window rule sees x 1 day after primer2 and 20 after primer1, so it
;; takes primer2; then y has nowhere to go. It can't see a shipment in pieces.
(test-equal "the window rule, and where it disagrees"
  '(((("c" . "forms") ("x" . "primer2")) ("f1" "f2") ("a" "b" "p" "y")) ("x"))
  (let-values (((by-window by-elimination) (compare story-orders story-charges)))
    (list (shown by-window) (disagreements by-window by-elimination))))

;; Amazon titles run long; a memo keeps each product's name
(test-equal "short-title: up to the first cut, then a word at a time"
  '("Acme Widget" "Acme Widget" "Acme Stainless Steel Kitchen Utensil Holder Organizer for Countertop…")
  (map short-title '("Acme Widget, 3 Pack (Blue)" "Acme Widget - Blue | Gift; "
                     "Acme Stainless Steel Kitchen Utensil Holder Organizer for Countertop Drawer Storage")))

(test-equal "short-items: counted when there's more than one"
  '("3: Bidet seat | CD | Toner" "Face primer" "")
  (map short-items (list (order-items (list-ref story-orders 4)) "Face primer; " "")))

(test-equal "memos: each piece of a shipment gets its order's"
  '(("a" . "[\"3: Bidet seat | CD | Toner\",{\"orderId\":\"bidet\"}]")
    ("b" . "[\"3: Bidet seat | CD | Toner\",{\"orderId\":\"bidet\"}]")
    ("c" . "[\"Breast forms\",{\"orderId\":\"forms\"}]")
    ("x" . "[\"Face primer\",{\"orderId\":\"primer1\"}]")
    ("y" . "[\"Face primer\",{\"orderId\":\"primer2\"}]"))
  (let-values (((by-window by-elimination) (compare story-orders story-charges)))
    (memos story-orders by-elimination)))

(test-equal "links: each piece of a shipment gets its order's page"
  '(("a" . "https://www.amazon.com/your-orders/order-details?orderID=bidet")
    ("b" . "https://www.amazon.com/your-orders/order-details?orderID=bidet")
    ("c" . "https://www.amazon.com/your-orders/order-details?orderID=forms")
    ("x" . "https://www.amazon.com/your-orders/order-details?orderID=primer1")
    ("y" . "https://www.amazon.com/your-orders/order-details?orderID=primer2"))
  (let-values (((by-window by-elimination) (compare story-orders story-charges)))
    (links by-elimination)))

(test-equal "the report"
  '("0-7 day window: 2 of 8 matched, 2 ambiguous, 4 no candidate"
    "elimination   : 5 of 8 matched, 2 ambiguous, 1 no candidate"
    "the two disagree on 1 charges"
    "shipped in 2 pieces: 2026-06-02 121.01 Bidet seat; CD, boxed; Toner"
    "    2026-06-05 95.87 AMAZON MKTPL*A5"
    "    2026-06-05 25.14 AMAZON MKTPL*B6"
    "ambiguous: 2026-03-03 39.36 AMAZON MKTPL*F3"
    "ambiguous: 2026-03-04 39.36 AMAZON MKTPL*F4"
    "no candidate: 2026-06-20 14.99 AMAZON PRIME*P8")
  (let-values (((by-window by-elimination) (compare story-orders story-charges)))
    (report story-orders story-charges by-window by-elimination)))

;; Later, Link Amazon Orders reads memos back, from transactions matched
;; before we set links. Say x's and a's are as memos wrote them (a's
;; transaction has its card split too), old's is from amazon-matching.sql,
;; n's names no order, y's transaction has a link already, and someone
;; split a "mix" transaction between two orders.
(define story-memo
  (let-values (((by-window by-elimination) (compare story-orders story-charges)))
    (let ((written (memos story-orders by-elimination)))
      (lambda (key) (cdr (assoc key written))))))

(test-equal "memo-order-id"
  '("bidet" "111-OLD" #f #f)
  (map memo-order-id (list (story-memo "a") "[\"Gum; \",{\"orderId\":\"111-OLD\"}]" "[\"Towels\"]" "")))

(test-equal "missing-links: one per transaction; two orders is a conflict"
  '((("x" . "https://www.amazon.com/your-orders/order-details?orderID=primer1")
     ("a" . "https://www.amazon.com/your-orders/order-details?orderID=bidet")
     ("old" . "https://www.amazon.com/your-orders/order-details?orderID=111-OLD"))
    ("mix"))
  (let-values (((to-link conflicts)
                (missing-links
                 ;; txn    memo                  link
                 (list (list "x"   (story-memo "x") "")
                       (list "a"   (story-memo "a") "")
                       (list "a"   ""               "")
                       (list "y"   (story-memo "y") "https://example.com/receipt")
                       (list "old" "[\"Gum; \",{\"orderId\":\"111-OLD\"}]" "")
                       (list "n"   "[\"Towels\"]"   "")
                       (list "mix" (story-memo "x") "")
                       (list "mix" (story-memo "c") "")))))
    (list to-link conflicts)))

;; memos used to keep azad's items whole; Shorten Amazon Memos rewrites
;; those, and nothing else: not a short memo, nor one with more typed after
(test-equal "shorter-memo"
  (list "[\"3: Bidet seat | CD | Toner\",{\"orderId\":\"bidet\"}]"
        "[\"Joy-Con\",{\"orderId\":\"jc\"}]"
        #f #f #f)
  (map shorter-memo
       (list "[\"Bidet seat; CD, boxed; Toner; \",{\"orderId\":\"bidet\"}]"
             "[\"Joy-Con (L/R) - Neon;\",{\"orderId\":\"jc\"}]"
             (story-memo "a")
             "[\"Joy-Con;\",{\"orderId\":\"jc\"}] for B"
             "[\"Towels\"]")))

(define failures (test-runner-fail-count (test-runner-current)))
(test-end "amazon-match")
(exit (zero? failures))
