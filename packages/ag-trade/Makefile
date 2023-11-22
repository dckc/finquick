STATE=$(shell endo where state)
PET=$(STATE)/pet-store

where:
	@echo state: $(STATE)

reserve-add: $(PET)/reserve-tool $(PET)/user1-kit $(PET)/u1-ist
	@echo ++ Add to reserve
	endo eval "E(reserve).addToReserve(kit.smartWallet, \
	  { brand, value: 7_000_000n }, 'add2')" \
	  reserve:reserve-tool kit:user1-kit brand:u1-ist

$(PET)/u1-ist: $(PET)/user1-kit
	@echo ++ look up IST in user1 marshal context
	endo eval "E(kit.query).lookup('agoricNames', 'brand', 'IST')" -n u1-ist kit:user1-kit

$(PET)/reserve-tool: src/reserve-add.js
	@echo ++ instantiate reserve add tool
	endo make src/reserve-add.js -n reserve-tool

$(PET)/user1-kit: $(PET)/desktop-secrets $(PET)/wallet-factory
	@echo ++ Instantiate SigningStargetClient for user1
	endo eval "E(E(secrets).makePassKey({ username: 'user1' })).get().then( \
		m => E(wf).makeWalletKit(m, 'http://localhost:26657', 'http://localhost:1317'))" \
		secrets:desktop-secrets wf:wallet-factory -n user1-client \
		-n user1-kit

$(PET)/wallet-factory: src/smartWallet.js
	@echo ++ install smart wallet plugin
	endo make --UNSAFE src/smartWallet.js -n wallet-factory

get-brand: $(PET)/ist-brand

$(PET)/ist-brand: $(PET)/query-tool
	@echo ++ Get IST brand
	endo eval "E(hub).lookup('agoricNames', 'brand', 'IST')" hub:query-tool -n ist-brand

$(PET)/query-tool: $(PET)/client-maker
	@echo ++ Instantiate QueryTool
	endo eval "E(mkClient).makeQueryTool('http://localhost:1317')" mkClient:client-maker -n query-tool

send-tokens: $(PET)/validator-client
	@echo ++ Send tokens
	endo eval "E(client).sendTokens(\
	  'agoric14pfrxg63jn6ha0cp6wxkm4nlvswtscrh2pymwm', \
	  'agoric1a3zu5aqw255q0tuxzy9aftvgheekw2wedz3xwq', \
	  [{ denom: 'ubld', amount: '12345' }], 'auto').then( \
	  tx => tx.code === 0 ? tx.transactionHash : assert.fail(tx.rawLog))" client:validator-client

$(PET)/validator-client: $(PET)/validator-passkey $(PET)/client-maker
	@echo ++ Instantiate SigningStargetClient
	endo eval "E(key).get().then(m => E(mkClient).makeTxTool(m, 'http://localhost:26657'))" mkClient:client-maker key:validator-passkey -n validator-client

$(PET)/validator-signer: $(PET)/signer-maker $(PET)/validator-passkey
	endo eval "E(key).get().then(m => E(mkSign).fromMnemonic(m))" mkSign:signer-maker key:validator-passkey -n validator-signer

$(PET)/client-maker: src/smartWallet.js
	@echo ++ make endo plugin for SigningStargetClient
	endo make --UNSAFE src/smartWallet.js -n client-maker

$(PET)/signer-maker: src/hdWallet.js
	@echo ++ make endo plugin for hd wallets
	endo make --UNSAFE src/hdWallet.js -n signer-maker

$(PET)/validator-passkey: $(PET)/desktop-secrets
	endo eval "E(secrets).makePassKey({ username: 'validator' })" -n validator-passkey secrets:desktop-secrets

sync: $(PET)/synctool $(PET)/gcdb $(PET)/finsync
	@echo ++ Push GnuCash transation ids to Sheetsync
	endo eval "E(synctool).pushTxIds(sc, gc)" synctool gc:gcdb sc:finsync

$(PET)/synctool: src/txSync.js
	@echo ++ instantiate confined sync tool
	endo make src/txSync.js -n synctool

db: $(PET)/gdcb

watchdl: $(PET)/watchdl

$(PET)/watchdl: $(PET)/fsevents
	@echo ++ make watcher for ~/Downloads
	endo eval "'$${HOME}/Downloads'" -n dl
	endo eval "E(fsevents).subWatcher(dl)" -n watchdl dl fsevents

$(PET)/fsevents: src/fileWatcher.js
	@echo ++ make endo plugin for file watcher
	endo make --UNSAFE src/fileWatcher.js -n fsevents

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

$(PET)/desktop-secrets: ../fincaps/src/secret-tool.js
	@echo ++ make endo plugin for desktop secrets
	endo make -n desktop-secrets --UNSAFE ../fincaps/src/secret-tool.js

clean:
	endo reset
