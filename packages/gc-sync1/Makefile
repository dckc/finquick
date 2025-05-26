SQLITE3 = sqlite3
# determined with
# gnucash --debug --extra
# per https://wiki.gnucash.org/wiki/Python_shell
PYINIT=/usr/share/gnucash/python/init.py
#
# tested with
# https://packages.ubuntu.com/jammy/gnucash 1:4.8-1build2

CONFIG=$(HOME)/.config/gnucash/config-user.scm
# (gnc-build-userdata-path "...")
USERDATA=$(HOME)/.local/share/gnucash/


simple-checkbook.sql: simple-checkbook.gnucash
	$(SQLITE3) $< .dump >$@ || (rm $@; exit 1)

# dead end. no way to add menu item to run python code
pyshell-enable:
	echo change if False: to if True:
	EDITOR=gedit sudoedit $(PYINIT)