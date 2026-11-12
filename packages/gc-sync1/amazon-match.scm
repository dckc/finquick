;; amazon-match.scm
;; Reports > Finquick > Match Amazon Orders: set the memos of
;; uncategorized Amazon charges (Imbalance splits) to their orders'
;; items and ids, matching by process of elimination
;; (amazon-match-lib.scm). Shows the report and asks first.
;;
;; Authority: this file holds it. The library gets each split as an
;; opaque handle and returns which matched; only run-match-amazon
;; sets a memo, and only after the person says yes.
;;
;; Load from ~/.config/gnucash/config-user.scm; see README.md.
;;
;; Copyright (C) 2026 by Dan Connolly
;; SPDX-License-Identifier: Apache-2.0

(load (gnc-build-userdata-path "finquick-menu.scm"))
(load (gnc-build-userdata-path "amazon-match-lib.scm"))
(use-modules (amazon-match-lib))
(use-modules ((srfi srfi-1) #:select (filter-map take)))
(use-modules ((srfi srfi-11) #:select (let-values)))
(use-modules ((ice-9 rdelim) #:select (read-line)))
(use-modules ((gnucash core-utils) #:select (N_)))
(use-modules (gnucash engine))
(use-modules (gnucash app-utils))   ; gnc-get-current-root-account
(use-modules (gnucash gnome-utils)) ; gnc-verify-dialog, gnc-info-dialog

(define amazon-imbalance-code "9001")
(define amazon-report-lines-shown 20)

;; GnuCash's Scheme has no file chooser, so: a known place.
(define (amazon-orders-path)
  (string-append (getenv "HOME") "/Downloads/amazon_order_history.csv"))

(define (amazon-file-lines path)
  (call-with-input-file path
    (lambda (port)
      (let loop ((lines '()))
        (let ((line (read-line port)))
          (if (eof-object? line)
              (reverse lines)
              (loop (cons (string-trim-right line #\return) lines))))))))

(define (amazon-uncategorized-charges root start)
  "the Imbalance account's uncategorized Amazon charges since start,
each with its split as handle"
  (let ((acct (gnc-account-lookup-by-code root amazon-imbalance-code)))
    (when (or (not acct) (null? acct))
      (error "no account with code" amazon-imbalance-code))
    (filter-map
     (lambda (split)
       (let* ((txn (xaccSplitGetParent split))
              (date (gnc-print-time64 (xaccTransGetDate txn) "%Y-%m-%d"))
              (description (xaccTransGetDescription txn)))
         (and (uncategorized-amazon? description (xaccSplitGetMemo split) date start)
              (make-charge (gncSplitGetGUID split) date (xaccSplitGetAmount split) description split))))
     (xaccAccountGetSplitList acct))))

(define (amazon-set-memo! split memo)
  (unless (string-null? (xaccSplitGetMemo split))
    (error "memo set meanwhile on split" (gncSplitGetGUID split)))
  (let ((txn (xaccSplitGetParent split)))
    (xaccTransBeginEdit txn)
    (xaccSplitSetMemo split memo)
    (xaccTransCommitEdit txn)))

;; the dialogs take a printf format
(define (amazon-printf-safe s) (string-join (string-split s #\%) "%%"))

(define (amazon-preview path lines to-set)
  (let ((shown (if (> (length lines) amazon-report-lines-shown)
                   (append (take lines amazon-report-lines-shown) '("..."))
                   lines)))
    (string-append path "\n\n" (string-join shown "\n")
                   (format #f "\n\nSet ~a memos? Each is saved as it's made." (length to-set)))))

(define (run-match-amazon window)
  (let* ((path (amazon-orders-path))
         (orders (parse-orders (amazon-file-lines path)))
         (charges (amazon-uncategorized-charges (gnc-get-current-root-account)
                                                (earliest-order-date orders)))
         (handle (lambda (key)
                   (charge-handle (car (filter-map (lambda (c) (and (string=? (charge-key c) key) c))
                                                   charges))))))
    (let-values (((by-window by-elimination) (compare orders charges)))
      (let ((lines (report orders charges by-window by-elimination))
            (to-set (memos orders by-elimination)))
        (cond
         ((null? to-set)
          (gnc-info-dialog '() (amazon-printf-safe (string-join (cons path lines) "\n"))))
         ((gnc-verify-dialog '() #f (amazon-printf-safe (amazon-preview path lines to-set)))
          (for-each (lambda (pr) (amazon-set-memo! (handle (car pr)) (cdr pr))) to-set)
          (gnc-info-dialog '() (format #f "Set ~a memos." (length to-set)))))))))

(define (amazon-match-failed key . args)
  (format (current-error-port) "amazon-match failed: ~a ~s~%" key args)
  (gnc-error-dialog '() (amazon-printf-safe (format #f "Match Amazon Orders failed: ~a ~s" key args))))

(gnc-add-scm-extension
 (gnc:make-menu-item
  (N_ "Match Amazon Orders")
  "caa6e750-447e-4dae-8971-95deb7600626"
  (N_ "Set memos of uncategorized Amazon charges from amazon_order_history.csv")
  finquick-menu-path
  (lambda (window)
    (catch #t (lambda () (run-match-amazon window)) amazon-match-failed))))
