# QuickJS SQLite Web Server Makefile

# Configuration
QJS_SRC ?= quickjs
QWS_SRC ?= quickwebserver
SQLITE_SRC ?= qjs-sqlite3
BUILD_DIR := build
DB ?= finance.sqlite

QJS := $(BUILD_DIR)/qjs
QWS_MOD := $(BUILD_DIR)/qws.so
SQLITE_MOD := $(BUILD_DIR)/sqlite3.so

.PHONY: all install run query clean realclean

all: install

install: $(QJS) $(QWS_MOD) $(SQLITE_MOD)

$(QJS_SRC)/.git/config:
	git clone https://github.com/bellard/quickjs.git $(QJS_SRC)

$(QWS_SRC)/.git/config:
	git clone https://github.com/QuickJS-web-project/quickwebserver.git $(QWS_SRC)

$(SQLITE_SRC)/.git/config:
	git clone https://github.com/ratboy666/qjs-sqlite3.git $(SQLITE_SRC)

$(QJS): $(QJS_SRC)/.git/config
	mkdir -p $(BUILD_DIR)
	cd $(QJS_SRC) && make -j && cp qjs ../$(BUILD_DIR)/qjs

$(QWS_MOD): $(QWS_SRC)/.git/config $(QJS_SRC)/.git/config $(QWS_SRC)/c/httpserver.h
	mkdir -p $(BUILD_DIR)
	gcc -Wall -O2 -fPIC -DJS_SHARED_LIBRARY -DEPOLL -I$(QJS_SRC) \
		-shared -o $(BUILD_DIR)/qws.so \
		$(QWS_SRC)/c/quickwebserver.c

$(QWS_SRC)/c/httpserver.h:
	curl -s https://raw.githubusercontent.com/jeremycw/httpserver.h/master/httpserver.h --output $@ > /dev/null
	echo XXXXX needs a patch: comment out common.h on line 650

$(SQLITE_MOD): $(SQLITE_SRC)/.git/config
	mkdir -p $(BUILD_DIR)
	cd $(SQLITE_SRC) && gcc -g -DJS_SHARED_LIBRARY=1 -I.. -fPIC -O2 -shared -o sqlite3.so sqlite3.c -lsqlite3
	cp $(SQLITE_SRC)/sqlite3.so $(BUILD_DIR)/sqlite3.so

/usr/include/sqlite3.h:
	sudo apt install libsqlite3-dev

run: install
	$(QJS) -m server.js

query: install
	@echo "Running query against $(DB)"
	$(QJS) -m query.js $(DB)

clean:
	rm -rf $(BUILD_DIR)

realclean: clean
	rm -rf $(QJS_SRC) $(QWS_SRC) $(SQLITE_SRC)
