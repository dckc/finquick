;; sync-uncat.scm
;; Synchronize uncategorized splits from external data

(define-module (sync-uncat-lib))
(use-modules ((srfi srfi-1) #:select (remove every)))
(use-modules ((srfi srfi-11) #:select (let-values)))
(use-modules ((srfi srfi-71) #:select (let*)))
(use-modules ((gnucash core-utils) #:select (N_)))
(use-modules ((gnucash utilities) #:select
  (gnc:msg gnc:debug gnc:warn gnc:gui-msg)))
(use-modules ((gnucash report report-utilities) #:select (gnc:strify)))
(use-modules ((web client) #:select (http-request)))
(use-modules ((web response) #:select (response-code response-headers)))
(use-modules ((gnucash json builder) #:select (scm->json-string)))
;; #:select doesn't work for xaccTransGetDate etc.
;; maybe due to FFI magic in (gnucash engine)?
(use-modules (gnucash engine)) ;; #select (
;; xaccSplitSetAccount xaccSplitGet* xaccTransGet* xaccAccountGet*
;; gnc-account-lookup-by-name gnc-account-get-children-sorted gnc-print-time64)
;; (load-and-reexport (sw_app_utils) ...)
(use-modules (gnucash app-utils)) ;; #:select (gnc-get-current-book gnc-get-current-root-account)

(export run-push-tx-ids)
(export run-pull-categories)

;; Uncategorized transaction data structure for use with scm->json
;; See also EXPECTED_POST_BODY_FORMAT in syncSvc.js
(define (valid-transaction? obj)
  (and (list? obj)
       (every pair? obj)
       (let ((guid        (assoc "guid" obj))
             (date        (assoc "date" obj))
             (account     (assoc "account" obj))
             (description (assoc "description" obj))
             (amount      (assoc "amount" obj)))
         (and guid (string? (cdr guid))
              date (string? (cdr date))
              account (string? (cdr account))
              description (string? (cdr description))
              amount (number? (cdr amount))))))

(define (split-record split)
  (let* ((parent (xaccSplitGetParent split))
        (other (xaccSplitGetOtherSplit split))
        (account-code (xaccAccountGetCode (xaccSplitGetAccount other)))
        (amount (xaccSplitGetAmount split))
        (time64 (xaccTransGetDate parent))
        (datetime-str (gnc-print-time64 time64 "%Y-%m-%d %H:%M:%S"))
        )
    ;; JSON builder object
    `(("date" . ,datetime-str)
      ("account" . ,account-code)
      ("description" . ,(xaccTransGetDescription parent))
      ;; exact->inexact is a little scary
      ;; how about #(,(numerator amount) "/" ,(denominator amount))?
      ("amount" . ,amount)
      ("guid" . ,(gncTransGetGUID parent))   
      )))

(define* (uncat-splits root #:key (name "Imbalance-USD"))
  (xaccAccountGetSplitList (gnc-account-lookup-by-name root name)))

(define (explore-gnucash-api)
  (let* ((book (gnc-get-current-book))
         (root (gnc-get-current-root-account))
         (accts (gnc-account-get-children-sorted root))
         (acct-uncat (gnc-account-lookup-by-name root "Imbalance-USD")))
    ;; (format #t ...) would likely obviate (display ...)
    (format #t "book: ~a\n" book)
    (format #t "root: ~a\n" root)
    (format #t "accts: ~s\n" (map (lambda (a) (xaccAccountGetName a)) accts))
    (format #t "uncat: ~a\n" (gnc:strify acct-uncat))))

(define (logged label x)
  (format #t label x)
  x)

(define* (http-post* url #:key (method 'POST) (body #f) (headers '()))
  (let-values (((resp resp-body)
                (http-request url #:method method #:headers headers #:body body)))
    (if (memq (response-code (logged "resp ~a~%" resp)) '(301 302 303))
      (let ((url2 (cdr (assoc 'location (response-headers resp)))))
        ;; switch to GET on redirect
        (http-request (logged "redirect to ~a~%" url2)
          #:method 'GET #:headers headers #:body body))
      (values resp body))))

(define (run-push-tx-ids window)
  ;; (display "hi from run-push-tx-ids\n")
  (explore-gnucash-api)
  (let* ((root (gnc-get-current-root-account))
         (records (logged "uncat records sexp: ~%~a~%" (map split-record (uncat-splits root))))
         (invalid-records (remove valid-transaction? records))
         (data `(("transactions" . ,(list->vector records)))))
    (unless (null? invalid-records)
        (error "bad records:" invalid-records))
    (gnc:gui-msg "?" (format #f "found ~a uncategorized transactions to POST" (length records)))
    (let-values (((response response-body)
                  (http-post* (logged "XXX ambient env URL: ~a~%" (getenv "FINSYNC"))
                   #:method 'POST
                   #:headers `((content-type . (application/json)))
                   #:body (logged "uncat records JSON: ~%~a~%"
                           (scm->json-string data #:pretty #t)))))
            (unless (eqv? (response-code response) 200)
              (format #t "error body: ~a~%" response-body)
              (error "unexpected response" response)))
    (gnc:gui-msg "?" "POSTed")
    ))


(define cups-home "http://localhost:631") ; HTTP server that happens to be handy

(define* (fetch-stuff #:key (url cups-home))
  (gnc:warn "XXX ambient net access. TODO: inject\n")
  (let* ((response body (http-request url)))
    ;; TODO: error handling
    ;; (if (not (eql (response-code response) 200))
    ;;  (error (response-reason-phrase response)))
    body
    )
  )

;; experimentally verify that we can sert the "Category" of 1 split.
(define (sync1 root)
  (let* ((uncat (gnc-account-lookup-by-name root "Imbalance-USD"))
         (cat (gnc-account-lookup-by-name root "Discretionary"))
         (haystack (xaccAccountGetSplitList uncat)))
    (unless (null? haystack)
      (let ((needle (car haystack)))
        (xaccSplitSetAccount needle cat)))))

(define (run-pull-categories window)
  (display "hi from run-pull-categories\n")
  (let* (
         (root (gnc-get-current-root-account))
         (acct-uncat (gnc-account-lookup-by-name root "Imbalance-USD") )
         )
    (format #t "root: ~a\n" root)
    (format #t "uncat: ~a\n" (gnc:strify acct-uncat))
    (let ((body (fetch-stuff)))
      (gnc:gui-msg "XXX" (format #f "HTTP GET: length: ~a" (string-length body))))
    (sync1 root)
    (gnc:gui-msg "XXX unused?" "didn't crash: sync1\n")
    ))
