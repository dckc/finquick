;; clean-desc-lib.scm
;; Strip payment-processor prefixes (TST*, SQ *, ...) from descriptions,
;; so that sorting a register by description groups by merchant.
;;
;; Pure: no GnuCash, so `make test` runs it with plain guile.
;; The Reports menu item that applies it is in clean-desc.scm.
;;
;; Copyright (C) 2026 by Dan Connolly
;; SPDX-License-Identifier: Apache-2.0

(define-module (clean-desc-lib))
(use-modules ((srfi srfi-1) #:select (find filter-map)))

(export processor-prefixes clean-description description-changes)

;; What the 2025-12-31 hand clean-up (qtrx f5a4bc1) stripped. Not every
;; NAME* is a processor: UBER *, TMOBILE*, APL* name the merchant, so
;; this is a list to edit, not a pattern.
(define processor-prefixes
  '("DDA PUR "   ; UMB debit card purchase
    "TST*"       ; Toast
    "SQ *"       ; Square
    "PAR*"       ; PAR / Punchh
    "LOY*"
    "PAYPAL *"
    "GOOGLE *"
    "GRUBHUB*"))

(define* (clean-description desc #:optional (prefixes processor-prefixes))
  "DESC without leading PREFIXES, repeatedly (DDA PUR TST*...), nor the
spaces after them; DESC itself if nothing would be left."
  (let loop ((s desc))
    (let ((p (find (lambda (p) (string-prefix? p s)) prefixes)))
      (if p
          (let ((rest (string-trim (substring s (string-length p)))))
            (if (string-null? rest) s (loop rest)))
          s))))

(define* (description-changes items #:key (description-of identity)
                              (prefixes processor-prefixes))
  "(item old new) for each of ITEMS whose description would change."
  (filter-map (lambda (item)
                (let* ((old (description-of item))
                       (new (clean-description old prefixes)))
                  (and (not (string=? old new)) (list item old new))))
              items))
