SQLITE3 = sqlite3

simple-checkbook.sql: simple-checkbook.gnucash
	$(SQLITE3) $< .dump >$@ || (rm $@; exit 1)
