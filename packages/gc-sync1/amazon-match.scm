;; amazon-match.scm
;; Reports > Finquick > Match Amazon Orders: set the memos of
;; uncategorized Amazon charges (Imbalance splits) to their orders'
;; items and ids, and their transactions' document links to the
;; orders' pages, matching by process of elimination
;; (amazon-match-lib.scm). Shows the report and asks first.
;;
;; Reports > Finquick > Link Amazon Orders: link transactions matched
;; earlier (whose memos name an order) to their orders' pages.
;;
;; Reports > Finquick > Shorten Amazon Memos: in uncategorized splits
;; matched earlier, cut azad's long item titles down to names.
;;
;; Authority: this file holds it. The library gets each split as an
;; opaque handle and returns which matched; only match-amazon-orders
;; sets a memo or link, and only after the person says yes.
;;
;; Load from ~/.config/gnucash/config-user.scm; see README.md.
;;
;; Copyright (C) 2026 by Dan Connolly
;; SPDX-License-Identifier: Apache-2.0

(load (gnc-build-userdata-path "finquick-menu.scm"))
(load (gnc-build-userdata-path "amazon-match-lib.scm"))
(use-modules (amazon-match-lib))
(use-modules ((srfi srfi-1) #:select (append-map filter-map take)))
(use-modules ((srfi srfi-11) #:select (let-values)))
(use-modules ((ice-9 rdelim) #:select (read-line)))
(use-modules ((ice-9 popen) #:select (open-pipe* close-pipe))) ; OPEN_READ is core
(use-modules ((gnucash core-utils) #:select (N_)))
(use-modules (gnucash engine))
(use-modules (gnucash app-utils))   ; gnc-get-current-root-account
(use-modules (gnucash gnome-utils)) ; gnc-verify-dialog, gnc-info-dialog

(define amazon-imbalance-code "9001")
(define amazon-report-lines-shown 20)

(define (amazon-downloads) (string-append (getenv "HOME") "/Downloads/"))

;; GnuCash's Scheme has no file chooser (gnc_file_dialog isn't bound),
;; so we ask zenity: the person designates the one file to read.
(define (amazon-choose-orders-file)
  "the CSV the person picks, or #f if they cancel; without zenity,
amazon_order_history.csv in ~/Downloads"
  (define fallback (string-append (amazon-downloads) "amazon_order_history.csv"))
  (catch 'system-error
    (lambda ()
      (let* ((port (open-pipe* OPEN_READ "zenity" "--file-selection"
                               "--title=Amazon order history (from azad)"
                               (string-append "--filename=" (amazon-downloads))
                               "--file-filter=azad CSV | amazon_order_history*.csv"
                               "--file-filter=All files | *"))
             (path (read-line port))
             (code (status:exit-val (close-pipe port))))
        (cond
         ((and (eqv? code 0) (string? path) (not (string-null? path))) path)
         ((eqv? code 127) fallback)  ; no zenity, by way of a shell
         (else #f))))                ; cancelled, or zenity failed
    (lambda args fallback)))         ; no zenity

(define (amazon-file-lines path)
  (call-with-input-file path
    (lambda (port)
      (let loop ((lines '()))
        (let ((line (read-line port)))
          (if (eof-object? line)
              (reverse lines)
              (loop (cons (string-trim-right line #\return) lines))))))))

(define (amazon-imbalance root)
  (let ((acct (gnc-account-lookup-by-code root amazon-imbalance-code)))
    (when (or (not acct) (null? acct))
      (error "no account with code" amazon-imbalance-code))
    acct))

(define (amazon-uncategorized-charges root start)
  "the Imbalance account's uncategorized Amazon charges since start,
each with its split as handle"
  (let ((acct (amazon-imbalance root)))
    (filter-map
     (lambda (split)
       (let* ((txn (xaccSplitGetParent split))
              (date (gnc-print-time64 (xaccTransGetDate txn) "%Y-%m-%d"))
              (description (xaccTransGetDescription txn)))
         (and (uncategorized-amazon? description (xaccSplitGetMemo split) date start)
              (make-charge (gncSplitGetGUID split) date (xaccSplitGetAmount split) description split))))
     (xaccAccountGetSplitList acct))))

;; A transaction that already has a document link keeps it.
(define (amazon-set-link! txn url)
  (when (string-null? (xaccTransGetDocLink txn))
    (xaccTransBeginEdit txn)
    (xaccTransSetDocLink txn url)
    (xaccTransCommitEdit txn)))

(define (amazon-annotate! split memo url)
  (unless (string-null? (xaccSplitGetMemo split))
    (error "memo set meanwhile on split" (gncSplitGetGUID split)))
  (let ((txn (xaccSplitGetParent split)))
    (xaccTransBeginEdit txn)
    (xaccSplitSetMemo split memo)
    (amazon-set-link! txn url)
    (xaccTransCommitEdit txn)))

;; the dialogs take a printf format
(define (amazon-printf-safe s) (string-join (string-split s #\%) "%%"))

(define (amazon-shown lines)
  (string-join (if (> (length lines) amazon-report-lines-shown)
                   (append (take lines amazon-report-lines-shown) '("..."))
                   lines)
               "\n"))

(define (amazon-preview path lines to-set)
  (string-append path "\n\n" (amazon-shown lines)
                 (format #f "\n\nSet ~a memos and links? Each is saved as it's made." (length to-set))))

(define (run-match-amazon window)
  (let ((path (amazon-choose-orders-file)))
    (when path
      (match-amazon-orders path))))

(define (match-amazon-orders path)
  (let* ((orders (parse-orders (amazon-file-lines path)))
         (charges (amazon-uncategorized-charges (gnc-get-current-root-account)
                                                (earliest-order-date orders)))
         (handle (lambda (key)
                   (charge-handle (car (filter-map (lambda (c) (and (string=? (charge-key c) key) c))
                                                   charges))))))
    (let-values (((by-window by-elimination) (compare orders charges)))
      (let ((lines (report orders charges by-window by-elimination))
            (to-set (memos orders by-elimination))
            (urls (links by-elimination)))
        (cond
         ((null? to-set)
          (gnc-info-dialog '() (amazon-printf-safe (string-join (cons path lines) "\n"))))
         ((gnc-verify-dialog '() #f (amazon-printf-safe (amazon-preview path lines to-set)))
          (for-each (lambda (pr url) (amazon-annotate! (handle (car pr)) (cdr pr) (cdr url)))
                    to-set urls)
          (gnc-info-dialog '() (format #f "Set ~a memos and links." (length to-set)))))))))

(define (amazon-memo-entries root)
  "the book's splits whose memos name an order, as missing-links
entries keyed by transaction guid, and a table from guid to transaction"
  (let ((txns (make-hash-table)))
    (values
     (append-map
      (lambda (acct)
        (filter-map
         (lambda (split)
           (let ((memo (xaccSplitGetMemo split)))
             (and (memo-order-id memo)
                  (let* ((txn (xaccSplitGetParent split))
                         (key (gncTransGetGUID txn)))
                    (hash-set! txns key txn)
                    (list key memo (xaccTransGetDocLink txn))))))
         (xaccAccountGetSplitList acct)))
      (gnc-account-get-descendants root))
     txns)))

(define (amazon-txn-line txn)
  (string-append (gnc-print-time64 (xaccTransGetDate txn) "%Y-%m-%d") " "
                 (xaccTransGetDescription txn)))

(define (link-amazon-orders)
  (let-values (((entries txns) (amazon-memo-entries (gnc-get-current-root-account))))
    (let-values (((to-link conflicts) (missing-links entries)))
      (let* ((txn-of (lambda (key) (hash-ref txns key)))
             (lines (append (sort (map (lambda (pr) (amazon-txn-line (txn-of (car pr)))) to-link) string<?)
                            (map (lambda (key) (string-append "memos name more than one order: "
                                                              (amazon-txn-line (txn-of key))))
                                 conflicts)))
             (text (amazon-printf-safe (amazon-shown lines))))
        (cond
         ((null? to-link)
          (gnc-info-dialog '() (string-append "No transactions to link.\n\n" text)))
         ((gnc-verify-dialog '() #f (string-append text (format #f "\n\nLink ~a transactions to their Amazon order pages?"
                                                                (length to-link))))
          (for-each (lambda (pr) (amazon-set-link! (txn-of (car pr)) (cdr pr))) to-link)
          (gnc-info-dialog '() (format #f "Linked ~a transactions." (length to-link)))))))))

(define (shorten-amazon-memos)
  (let* ((splits (xaccAccountGetSplitList (amazon-imbalance (gnc-get-current-root-account))))
         (to-set (filter-map (lambda (split)
                               (let* ((memo (xaccSplitGetMemo split))
                                      (short (shorter-memo memo)))
                                 (and short (list split memo short))))
                             splits))
         (text (amazon-printf-safe
                (amazon-shown
                 (sort (map (lambda (e) (string-append (gnc-print-time64 (xaccTransGetDate (xaccSplitGetParent (car e)))
                                                                         "%Y-%m-%d")
                                                       " " (caddr e)))
                            to-set)
                       string<?)))))
    (cond
     ((null? to-set)
      (gnc-info-dialog '() "No memos to shorten."))
     ((gnc-verify-dialog '() #f (string-append text (format #f "\n\nShorten ~a memos?" (length to-set))))
      (for-each (lambda (e)
                  (let ((split (car e)) (txn (xaccSplitGetParent (car e))))
                    (unless (string=? (xaccSplitGetMemo split) (cadr e))
                      (error "memo changed meanwhile on split" (gncSplitGetGUID split)))
                    (xaccTransBeginEdit txn)
                    (xaccSplitSetMemo split (caddr e))
                    (xaccTransCommitEdit txn)))
                to-set)
      (gnc-info-dialog '() (format #f "Shortened ~a memos." (length to-set)))))))

(define (amazon-failed name)
  (lambda (key . args)
    (format (current-error-port) "~a failed: ~a ~s~%" name key args)
    (gnc-error-dialog '() (amazon-printf-safe (format #f "~a failed: ~a ~s" name key args)))))

(gnc-add-scm-extension
 (gnc:make-menu-item
  (N_ "Match Amazon Orders")
  "caa6e750-447e-4dae-8971-95deb7600626"
  (N_ "Set memos and links of uncategorized Amazon charges from amazon_order_history.csv")
  finquick-menu-path
  (lambda (window)
    (catch #t (lambda () (run-match-amazon window)) (amazon-failed "Match Amazon Orders")))))

(gnc-add-scm-extension
 (gnc:make-menu-item
  (N_ "Link Amazon Orders")
  "2f4daa4e-75af-4dab-a223-75bc38be7c91"
  (N_ "Link transactions whose memos name an Amazon order to the order's page")
  finquick-menu-path
  (lambda (window)
    (catch #t link-amazon-orders (amazon-failed "Link Amazon Orders")))))

(gnc-add-scm-extension
 (gnc:make-menu-item
  (N_ "Shorten Amazon Memos")
  "507a9355-a740-454f-9718-f983d29e6e08"
  (N_ "In uncategorized splits matched earlier, cut Amazon item titles down to names")
  finquick-menu-path
  (lambda (window)
    (catch #t shorten-amazon-memos (amazon-failed "Shorten Amazon Memos")))))
