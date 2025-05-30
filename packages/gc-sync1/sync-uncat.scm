;; sync-uncat.scm
;; Synchronize uncategorized splits from external data

(load  (gnc-build-userdata-path "sync-uncat-lib.scm"))
(use-modules (sync-uncat-lib))

(define (handle-exn key . args)
  ;; Handle or log the error
  (format (current-error-port) "Error in extension: ~a ~a~%" key args)
  ;; Optionally show GUI feedback
  (gnc:gui-msg "?" (format #f "Extension Failed: ~a" args)))

;; Register the menu items
(gnc-add-scm-extension
 (gnc:make-menu-item
  (N_ "Push Uncat Txs")          ; Name that appears in the menu
  "0d9fe0a6-de1b-4de5-a27c-1919cd9fe484"
  (N_ "Push uncategorized splits to SheetSync") ; Tooltip/Description
  (list (N_ "Tools"))             ; Path: "Tools" menu
  (lambda (window)
    (catch #t (lambda () (run-push-tx-ids window)) handle-exn))
  ))

(gnc-add-scm-extension
 (gnc:make-menu-item
  (N_ "Pull Categories")
  "c397d0f6-7876-4efd-a2b2-8eabd51ab63a"
  (N_ "Pull categories from SheetSync")
  (list (N_ "Tools"))
    (lambda (window)
    (catch #t (lambda () (run-pull-categories window)) handle-exn))
  ))

