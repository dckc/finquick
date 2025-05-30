;; sync-uncat.scm
;; Synchronize uncategorized splits from external data

;; Debugging
;; gnucash --debug --log gnc.scm=debug
;; per https://wiki.gnucash.org/wiki/Custom_Reports#Debugging_your_report

(define-module (sync-uncat-lib))

(use-modules (srfi srfi-71)) ; for let*
(use-modules (srfi srfi-1)) ; for remove
(use-modules (gnucash engine))      ; For ACCT-TYPE-INCOME
(use-modules (gnucash app-utils))   ; For gnc:message, if it works for logging.
(use-modules (gnucash core-utils))  ; For N_
(use-modules (gnucash utilities))   ; for gnc:msg etc.
(use-modules (gnucash gnome-utils)) ; for gnc:gui-msg etc.
(use-modules (gnucash report report-utilities))   ; for gnc:strify
(use-modules (web client)) ; for http-request
(use-modules (gnucash json))

(export run-push-tx-ids)
(export run-pull-categories)

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

(format #t "ACCT-TYPE-INCOME: ~a~%" ACCT-TYPE-INCOME)


(define (valid-transaction? obj)
  (and (list? obj)
       (every pair? obj)
       (let ((guid        (assoc "guid" obj))
             (date        (assoc "date" obj))
             (description (assoc "description" obj))
             (amount      (assoc "amount" obj)))
         (and guid (string? (cdr guid))
              date (string? (cdr date))
              description (string? (cdr description))
              amount (number? (cdr amount))))))

(define (split-record split)
  (let* ((parent (xaccSplitGetParent split))
        (acct (xaccSplitGetAccount split))
        (amount (xaccSplitGetAmount split))
        (time64 (xaccTransGetDate parent))
        (datetime-str (gnc-print-time64 time64 "%Y-%m-%d %H:%M:%S"))
        )
    ;; JSON builder object
    `(("date" . ,datetime-str)
      ("description" . ,(xaccTransGetDescription parent))
      ;; exact->inexact is a little scary
      ;; how about #(,(numerator amount) "/" ,(denominator amount))?
      ("amount" . ,amount)
      ("guid" . ,(gncTransGetGUID parent))   
      )))

(define cups-home "http://localhost:631") ; HTTP server that happens to be handy

;; XXX ambient net access. TODO: inject
(define* (fetch-stuff #:key (url cups-home))
  (let* ((response body (http-request url)))
    ;; TODO: error handling
    ;; (if (not (eql (response-code response) 200))
    ;;  (error (response-reason-phrase response)))
    body
    )
  )

;; TODO: lookup by code?
(define* (uncat-splits root #:key (name "Imbalance-USD"))
  (xaccAccountGetSplitList (gnc-account-lookup-by-name root name)))

(define (sync1 root)
  (let* ((uncat (gnc-account-lookup-by-name root "Imbalance-USD"))
         (cat (gnc-account-lookup-by-name root "Discretionary"))
         (haystack (xaccAccountGetSplitList uncat)))
    (unless (null? haystack)
      (let ((needle (car haystack)))
        (xaccSplitSetAccount needle cat)))))

(define (run-push-tx-ids window)
  (display "hi from run-push-tx-ids\n")
;;   (gnc:gui-msg "XXX unused?" "about to get uncat splits\n")
  (let* (
         (book (gnc-get-current-book))
         (root (gnc-get-current-root-account))
         (accts (gnc-account-get-children-sorted root))
         (acct-uncat (gnc-account-lookup-by-name root "Imbalance-USD") )
         )
    (display (format #f "book: ~a\n" book))
    (display (format #f "root: ~a\n" root))
    (display (format #f "accts: ~s\n" (map (lambda (a) (xaccAccountGetName a)) accts)))
    (display (format #f "uncat: ~a\n" (gnc:strify acct-uncat)))
    (display (format #f "uncat splits: ~a\n"
      (map gnc:strify (uncat-splits root))))
    (let* ((records (map split-record (uncat-splits root)))
           (invalid-records (remove valid-transaction? records))
           (data (list->vector records)))
       (unless (null? invalid-records)
         (error "bad records:" invalid-records))
       (display (format #f "uncat records sexp: ~%~a~%" records))
       (display (format #f "uncat records JSON: ~%~a~%" (scm->json-string data #:pretty #t))))
    (gnc:gui-msg "XXX unused?" "didn't crash: get uncat splits\n")
    (format #f "HTTP post in JSON")
    ))


(define (run-pull-categories window)
  (display "hi from run-pull-categories\n")
  (let* (
         (root (gnc-get-current-root-account))
         (acct-uncat (gnc-account-lookup-by-name root "Imbalance-USD") )
         )
    (display (format #f "root: ~a\n" root))
    (display (format #f "uncat: ~a\n" (gnc:strify acct-uncat)))
    (let ((body (fetch-stuff)))
      (gnc:gui-msg "XXX" (format #f "HTTP GET: length: ~a" (string-length body))))
    (sync1 root)
    (gnc:gui-msg "XXX unused?" "didn't crash: sync1\n")
    ))

;; these don't seem to work.
(gnc:debug "debug\n")
(gnc:msg "message\n")
(gnc:warn "warn\n")
