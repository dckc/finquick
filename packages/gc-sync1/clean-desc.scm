;; clean-desc.scm
;; Reports > Clean Descriptions: strip TST*, SQ *, ... from the descriptions
;; of uncategorized (Imbalance-USD) transactions, so sorting by
;; description groups by merchant. Shows what would change and asks
;; first: on a SQLite book each change is saved as it's made.
;;
;; Load from ~/.config/gnucash/config-user.scm; see README.md.
;;
;; Copyright (C) 2026 by Dan Connolly
;; SPDX-License-Identifier: Apache-2.0

(load (gnc-build-userdata-path "clean-desc-lib.scm"))
(use-modules (clean-desc-lib))
(use-modules ((srfi srfi-1) #:select (filter-map take)))
(use-modules ((gnucash core-utils) #:select (N_)))
(use-modules ((gnucash utilities) #:select (gnc:msg)))
(use-modules (gnucash engine))
(use-modules (gnucash app-utils))   ; gnc-get-current-root-account
(use-modules (gnucash gnome-utils)) ; gnc-verify-dialog, gnc-info-dialog

(define uncat-name "Imbalance-USD")
(define examples-shown 10)

(define (uncat-transactions root)
  "each transaction with a split in the uncat account, once"
  (let ((acct (gnc-account-lookup-by-name root uncat-name))
        (seen (make-hash-table)))
    (when (or (not acct) (null? acct))
      (error "no account named" uncat-name))
    (filter-map (lambda (split)
                  (let* ((txn (xaccSplitGetParent split))
                         (guid (gncTransGetGUID txn)))
                    (and (not (hash-ref seen guid))
                         (begin (hash-set! seen guid #t) txn))))
                (xaccAccountGetSplitList acct))))

;; the dialogs take a printf format
(define (printf-safe s) (string-join (string-split s #\%) "%%"))

(define (preview changes total)
  (let* ((n (length changes))
         (shown (take changes (min n examples-shown)))
         (lines (map (lambda (c) (format #f "~a\n    → ~a" (cadr c) (caddr c))) shown)))
    (string-append
     (format #f "Strip processor prefixes from ~a of ~a uncategorized descriptions?\n\n" n total)
     (string-join lines "\n")
     (if (> n examples-shown) (format #f "\n... and ~a more" (- n examples-shown)) "")
     "\n\nEach change is saved as it's made.")))

(define (set-description! txn new)
  (xaccTransBeginEdit txn)
  (xaccTransSetDescription txn new)
  (xaccTransCommitEdit txn))

(define (run-clean-descriptions window)
  (let* ((txns (uncat-transactions (gnc-get-current-root-account)))
         (changes (description-changes txns #:description-of xaccTransGetDescription)))
    (cond
     ((null? changes)
      (gnc-info-dialog '() (printf-safe
                            (format #f "No processor prefixes in ~a uncategorized descriptions."
                                    (length txns)))))
     ((gnc-verify-dialog '() #f (printf-safe (preview changes (length txns))))
      (for-each (lambda (c)
                  (gnc:msg "clean-desc: " (cadr c) " -> " (caddr c))
                  (set-description! (car c) (caddr c)))
                changes)
      (gnc-info-dialog '() (format #f "Cleaned ~a descriptions." (length changes)))))))

(define (clean-desc-failed key . args)
  (format (current-error-port) "clean-desc failed: ~a ~s~%" key args)
  (gnc-error-dialog '() (printf-safe (format #f "Clean Descriptions failed: ~a ~s" key args))))

(gnc-add-scm-extension
 (gnc:make-menu-item
  (N_ "Clean Descriptions")
  "9f767ba7-8ba6-4a0f-bd7e-406605e3d915"
  (N_ "Strip TST*, SQ * etc. from uncategorized transaction descriptions")
  ;; GnuCash 5 puts every Scheme extension in the Reports menu, whatever
  ;; the path says (gnc-plugin-menu-additions.c); so say so.
  (list "Reports/StandardReports")
  (lambda (window)
    (catch #t (lambda () (run-clean-descriptions window)) clean-desc-failed))))
