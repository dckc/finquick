# gcaps: webkeys for narrow views of Google data; see README.md
CLASP ?= npx -y @google/clasp@2.4.2

test:
	node --test

# src/ is Apps Script (one global scope); types/ declares what it uses
# that @types/google-apps-script lacks. From a worktree without
# node_modules: make typecheck NODE_MODULES=~/projects/finquick/node_modules
NODE_MODULES ?= ../../node_modules
typecheck:
	$(NODE_MODULES)/.bin/tsc -p jsconfig.json --typeRoots $(NODE_MODULES)/@types

# once: a new spreadsheet with this script bound to it; writes .clasp.json
create:
	cp src/appsscript.json appsscript.json.keep # create writes a default one
	$(CLASP) create --type sheets --title "Agent webkeys" --rootDir src
	mv appsscript.json.keep src/appsscript.json
	if [ -f src/.clasp.json ]; then mv src/.clasp.json .; fi # clasp 2.4.2 puts it in rootDir

push:
	$(CLASP) push

# The first deploy makes the URL that webkeys carry; after that, pass its
# id so the URL (and every webkey) stays: make deploy DEPLOYMENT_ID=AKf...
deploy: push
	$(CLASP) deploy $(if $(DEPLOYMENT_ID),--deploymentId $(DEPLOYMENT_ID)) --description "$(shell git describe --always --dirty)"

# make cache WEBKEY=~/.config/gcaps/hail-roof.webkey OUT=~/dmfin/.tmp/cache-gmail/hail-roof
cache:
	node scripts/mail-cache.js $(WEBKEY) $(OUT)

.PHONY: test typecheck create push deploy cache
