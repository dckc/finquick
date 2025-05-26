;; sync-uncat.scm
;; Synchronize uncategorized splits from external data

;; Debugging
;; gnucash --debug --log gnc.scm=debug
;; per https://wiki.gnucash.org/wiki/Custom_Reports#Debugging_your_report

(use-modules (gnucash engine))      ; For ACCT-TYPE-INCOME
(use-modules (gnucash app-utils))   ; For gnc:message, if it works for logging.
(use-modules (gnucash core-utils))  ; For N_
(use-modules (gnucash utilities))   ; for gnc:msg etc.
(use-modules (gnucash gnome-utils)) ; for gnc:gui-msg etc.
(use-modules (gnucash report report-utilities))   ; for gnc:strify

;; ;; Define a logging function that tries GnuCash's internal message system first
;; (define (log-message msg)
;;         (display (string-append "SCRIPT LOG: " msg "\n"))
;;         (force-output))

;; ;; This is the function that defines the action for your menu item
;; (define (run-get-book-info window) ; The lambda in make-menu-item receives the window object
;;   (let ((book (gnc-get-current-book)))
;;     (if book
;;         (let ((filename (gnc-book-get-filename book))) ; <<< TRY THIS: gnc-book-get-filename
;;           (if filename
;;               (log-message (string-append "Current GnuCash file: " filename))
;;               (log-message "Current GnuCash file name could not be retrieved (maybe not saved?).")))
;;         (log-message "No GnuCash file is currently open."))))

(format #t "ACCT-TYPE-INCOME: ~a\n" ACCT-TYPE-INCOME)

(define (show-acct acct)
 `((name . ,(xaccAccountGetName acct))
   (GUID . ,(gncAccountGetGUID acct))   
 ))

(define (show-split split)
 `((date . ,(xaccTransGetDate (xaccSplitGetParent split)))
   (GUID . ,(gncSplitGetGUID split))   
 ))


;; TODO: lookup by code?
(define* (uncat-splits root #:key (name "Imbalance-USD"))
  (let* ((acct-uncat (gnc-account-lookup-by-name root name))
         (splits-uncat (xaccAccountGetSplitList acct-uncat)))
    `((account . ,(gnc:strify acct-uncat))
      (splits . ,(map gnc:strify splits-uncat)))
))

(define (run-sync-uncat-tx window)
  (display "hi from run-sync-uncat-tx\n")
  (gnc:gui-msg "XXX unused?" "about to get uncat splits\n")
  (let* (
      (book (gnc-get-current-book))
      (root (gnc-get-current-root-account))
      (accts (gnc-account-get-children-sorted root))
      (acct-uncat (gnc-account-lookup-by-name root "Imbalance-USD") )
      )
    (display (format #f "book: ~a\n" book))
    (display (format #f "root: ~a\n" root))
    (display (format #f "accts: ~s\n" (map (lambda (a) (xaccAccountGetName a)) accts)))
    (display (format #f "uncat: ~a\n" (show-acct acct-uncat)))
    (display (format #f "uncat splits: ~a\n" (uncat-splits root)))
    )
  (gnc:gui-msg "XXX unused?" "didn't crash: get uncat splits\n")
  )

;; these don't seem to work.
(gnc:debug "debug\n")
(gnc:msg "message\n")
(gnc:warn "warn\n")

;; ;; Register the menu item
(gnc-add-scm-extension
 (gnc:make-menu-item
  (N_ "Sync Uncat Tx")          ; Name that appears in the menu
  "0d9fe0a6-de1b-4de5-a27c-1919cd9fe484"
  (N_ "Synchronize uncategorized splits from external data") ; Tooltip/Description
  (list (N_ "Tools"))             ; Path: "Tools" menu
  (lambda (window)                      ; The action function when clicked
    (run-sync-uncat-tx window)) ; Call your defined action function
  ))