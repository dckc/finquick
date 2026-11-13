;; clean-desc-test.scm -- run with: make test
(add-to-load-path (dirname (current-filename)))
(use-modules (srfi srfi-64) (clean-desc-lib))

(test-begin "clean-desc")

(test-equal "one prefix"
  "SPIN OVERLAND PARK KANSAS CITY MO"
  (clean-description "TST*SPIN OVERLAND PARK KANSAS CITY MO"))

(test-equal "the space after a prefix goes too"
  "BILLIES GROCERY Leawood KS"
  (clean-description "TST* BILLIES GROCERY Leawood KS"))

(test-equal "stacked prefixes"
  "THE GOOD"
  (clean-description "DDA PUR SQ *THE GOOD"))

(test-equal "only leading: a later SQ * stays"
  "THE GO SQ *THE GOOD"
  (clean-description "DDA PUR SQ *THE GO SQ *THE GOOD"))

(test-equal "a merchant's own star is not a processor's"
  "UBER *TRIP"
  (clean-description "UBER *TRIP"))

(test-equal "nothing left: keep it as it was"
  "TST*"
  (clean-description "TST*"))

(test-equal "unchanged"
  "Grace Fellowship"
  (clean-description "Grace Fellowship"))

(test-equal "changes: only those that change, as (item old new)"
  '((2 "PAYPAL *EBAY" "EBAY"))
  (description-changes '(1 2)
                       #:description-of (lambda (n) (if (= n 1) "Kroger" "PAYPAL *EBAY"))))

(define failures (test-runner-fail-count (test-runner-current)))
(test-end "clean-desc")
(exit (zero? failures))
