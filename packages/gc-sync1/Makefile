SQLITE3 = sqlite3
# determined with
# gnucash --debug --extra
# per https://wiki.gnucash.org/wiki/Python_shell
PYINIT=/usr/share/gnucash/python/init.py
#
# tested with
# https://packages.ubuntu.com/jammy/gnucash 1:4.8-1build2
SITE_GUILE=/usr/share/guile/site/3.0/
GUILE=guile
SO_LIBS=/usr/lib/x86_64-linux-gnu/gnucash:/usr/lib/x86_64-linux-gnu/gnucash/gnucash:/usr/lib/x86_64-linux-gnu

CONFIG=$(HOME)/.config/gnucash/config-user.scm
# (gnc-build-userdata-path "...")
USERDATA=$(HOME)/.local/share/gnucash/


simple-checkbook.sql: simple-checkbook.gnucash
	$(SQLITE3) $< .dump >$@ || (rm $@; exit 1)

# dead end. no way to add menu item to run python code
pyshell-enable:
	echo change if False: to if True:
	EDITOR=gedit sudoedit $(PYINIT)

repl:
	LD_LIBRARY_PATH=$(SO_LIBS) $(GUILE) -L $(SITE_GUILE)

test: sync-uncat.scm
	LD_LIBRARY_PATH=$(SO_LIBS) $(GUILE) -L $(SITE_GUILE) $<