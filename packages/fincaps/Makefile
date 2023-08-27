STATE=$(shell endo where state)
PET=$(STATE)/pet-store

where:
	@echo state: $(STATE)

sync: $(PET)/synctool $(PET)/gcdb $(PET)/finsync
	@echo ++ Push GnuCash transation ids to Sheetsync
	endo eval "E(synctool).pushTxIds(sc, gc)" synctool gc:gcdb sc:finsync

$(PET)/synctool: src/txSync.js
	@echo ++ instantiate confined sync tool
	endo make src/txSync.js -n synctool

db: $(PET)/gdcb

$(PET)/gcdb: $(PET)/hub1
	@echo ++ Choose a sqlite3 database file path
	endo eval "'$${GNUCASH_DB}'" -n p1
	@echo ++ look up the path in the DBHub
	endo eval "E(hub).lookup(path)" hub:hub1 path:p1 -n gcdb

$(PET)/hub1: ./src/dbTool.js
	@echo ++ Instantiate sqlite3 database hub plugin
	endo make -n hub1 --UNSAFE ./src/dbTool.js

sheet: $(PET)/finsync

$(PET)/finsync: $(PET)/fin-sync-creds $(PET)/gsheets
	@echo ++ Load a spreadsheet based on item from desktop secret store.
	endo eval "E(gsheets).load(item)" -n finsync gsheets item:fin-sync-creds

$(PET)/gsheets: src/sheetsTool.js
	@echo ++ make endo plugin for Google Sheets
	endo make --UNSAFE src/sheetsTool.js -n gsheets

$(PET)/fin-sync-creds: $(PET)/desktop-secrets
	@echo ++ make a PassKey to access finSync Google Sheet
	@echo ++ Assumes: secret-tool store --label='finSync' id 1-66j... title finSync \<project-id-661....json
	endo eval "'$${SHEET1_ID}'" -n finsync-id
	endo eval "E(secrets).makePassKey({ title: 'finSync', id })" -n fin-sync-creds secrets:desktop-secrets id:finsync-id

$(PET)/desktop-secrets: ./src/secret-tool.js
	@echo ++ make endo plugin for desktop secrets
	endo make -n desktop-secrets --UNSAFE ./src/secret-tool.js

clean:
	endo reset
