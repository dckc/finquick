;; finquick-menu.scm
;; Reports > Finquick: the submenu our menu items go in.
;;
;; GnuCash 5 shows Scheme menu extensions only in the Reports menu
;; (gnc-plugin-menu-additions.c). An item goes in a submenu when its
;; path is the submenu's path plus its label, and the submenu is itself
;; an extension, added once: a second copy hides it from later items.
;; So each handler file loads this one, and it adds the menu only once.
;;
;; Copyright (C) 2026 by Dan Connolly
;; SPDX-License-Identifier: Apache-2.0

(define finquick-menu-added? (defined? 'finquick-menu-path))

(define finquick-menu-path (list "Reports/StandardReports" "Finquick"))

(unless finquick-menu-added?
  (gnc-add-scm-extension
   (gnc:make-menu "Finquick" (list "Reports/StandardReports"))))
