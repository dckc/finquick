;; finquick-menu.scm
;; Reports > Finquick: the submenu our menu items go in.
;;
;; GnuCash 5 shows Scheme menu extensions only in the Reports menu
;; (gnc-plugin-menu-additions.c). An item goes in a submenu when its
;; path is the submenu's path plus its label, and the submenu is itself
;; an extension, added once: a second copy hides it from later items.
;; So each handler file loads this one, and it adds the menu only once.
;;
;; The label has its own mnemonic (the _). Through 5.14, GnuCash gives
;; a submenu label without one a mnemonic of its own, then files the
;; submenu under the new label, so items naming the old one land at
;; the top of Reports and the submenu shows up empty. Fixed on the
;; stable branch 2026-03-13 (672bb3c1); see
;; https://lists.gnucash.org/pipermail/gnucash-devel/2026-February/047239.html
;;
;; Copyright (C) 2026 by Dan Connolly
;; SPDX-License-Identifier: Apache-2.0

(define finquick-menu-added? (defined? 'finquick-menu-path))

(define finquick-menu-label "Fin_quick")

(define finquick-menu-path (list "Reports/StandardReports" finquick-menu-label))

(unless finquick-menu-added?
  (gnc-add-scm-extension
   (gnc:make-menu finquick-menu-label (list "Reports/StandardReports"))))
