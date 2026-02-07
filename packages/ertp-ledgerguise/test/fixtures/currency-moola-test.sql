-- Test: Can GnuCash GUI handle a commodity used as transaction currency?
-- This creates a single-transaction Moola↔Stock swap.

PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

-- Schema (minimal)
CREATE TABLE gnclock ( Hostname varchar(255), PID int );
CREATE TABLE versions(table_name text(50) PRIMARY KEY NOT NULL, table_version integer NOT NULL);
INSERT INTO versions VALUES('Gnucash',4000008);
INSERT INTO versions VALUES('Gnucash-Resave',19920);
INSERT INTO versions VALUES('books',1);
INSERT INTO versions VALUES('commodities',1);
INSERT INTO versions VALUES('accounts',1);
INSERT INTO versions VALUES('prices',3);
INSERT INTO versions VALUES('transactions',4);
INSERT INTO versions VALUES('splits',5);
INSERT INTO versions VALUES('slots',4);

CREATE TABLE books(guid text(32) PRIMARY KEY NOT NULL, root_account_guid text(32) NOT NULL, root_template_guid text(32) NOT NULL);
CREATE TABLE commodities(guid text(32) PRIMARY KEY NOT NULL, namespace text(2048) NOT NULL, mnemonic text(2048) NOT NULL, fullname text(2048), cusip text(2048), fraction integer NOT NULL, quote_flag integer NOT NULL, quote_source text(2048), quote_tz text(2048));
CREATE TABLE accounts(guid text(32) PRIMARY KEY NOT NULL, name text(2048) NOT NULL, account_type text(2048) NOT NULL, commodity_guid text(32), commodity_scu integer NOT NULL, non_std_scu integer NOT NULL, parent_guid text(32), code text(2048), description text(2048), hidden integer, placeholder integer);
CREATE TABLE prices(guid text(32) PRIMARY KEY NOT NULL, commodity_guid text(32) NOT NULL, currency_guid text(32) NOT NULL, date text(19) NOT NULL, source text(2048), type text(2048), value_num bigint NOT NULL, value_denom bigint NOT NULL);
CREATE TABLE transactions(guid text(32) PRIMARY KEY NOT NULL, currency_guid text(32) NOT NULL, num text(2048) NOT NULL, post_date text(19), enter_date text(19), description text(2048));
CREATE TABLE splits(guid text(32) PRIMARY KEY NOT NULL, tx_guid text(32) NOT NULL, account_guid text(32) NOT NULL, memo text(2048) NOT NULL, action text(2048) NOT NULL, reconcile_state text(1) NOT NULL, reconcile_date text(19), value_num bigint NOT NULL, value_denom bigint NOT NULL, quantity_num bigint NOT NULL, quantity_denom bigint NOT NULL, lot_guid text(32));
CREATE TABLE slots(id integer PRIMARY KEY AUTOINCREMENT NOT NULL, obj_guid text(32) NOT NULL, name text(4096) NOT NULL, slot_type integer NOT NULL, int64_val bigint, string_val text(4096), double_val float8, timespec_val text(19), guid_val text(32), numeric_val_num bigint, numeric_val_denom bigint, gdate_val text(8));

-- Book
INSERT INTO books VALUES('00000000000000000000000000000001','00000000000000000000000000000010','00000000000000000000000000000011');

-- Commodities: Moola (commodity, not currency!) and Stock
INSERT INTO commodities VALUES('00000000000000000000000000000020','CURRENCY','MOOLA','Moola Token',NULL,1,0,NULL,NULL);
INSERT INTO commodities VALUES('00000000000000000000000000000021','COMMODITY','STOCK','Stock Shares',NULL,1,0,NULL,NULL);

-- Accounts
-- Root
INSERT INTO accounts VALUES('00000000000000000000000000000010','Root Account','ROOT','00000000000000000000000000000020',1,0,NULL,'','',0,0);
INSERT INTO accounts VALUES('00000000000000000000000000000011','Template Root','ROOT',NULL,0,0,NULL,'','',0,0);
-- Alice's accounts
INSERT INTO accounts VALUES('00000000000000000000000000000100','Alice Moola','ASSET','00000000000000000000000000000020',1,0,'00000000000000000000000000000010','','',0,0);
INSERT INTO accounts VALUES('00000000000000000000000000000101','Alice Stock','STOCK','00000000000000000000000000000021',1,0,'00000000000000000000000000000010','','',0,0);
-- Bob's accounts
INSERT INTO accounts VALUES('00000000000000000000000000000200','Bob Moola','ASSET','00000000000000000000000000000020',1,0,'00000000000000000000000000000010','','',0,0);
INSERT INTO accounts VALUES('00000000000000000000000000000201','Bob Stock','STOCK','00000000000000000000000000000021',1,0,'00000000000000000000000000000010','','',0,0);

-- Price: 1 STOCK = 10 MOOLA
INSERT INTO prices VALUES('00000000000000000000000000000030','00000000000000000000000000000021','00000000000000000000000000000020','2026-01-28 00:00:00','user:price','last',10,1);

-- Single transaction: Alice gives 10 Moola, gets 1 Stock; Bob gives 1 Stock, gets 10 Moola
-- Transaction currency is MOOLA (a commodity!)
INSERT INTO transactions VALUES('00000000000000000000000000000040','00000000000000000000000000000020','SWAP-001','2026-01-28 00:00:00','2026-01-28 00:00:00','Moola-Stock Swap');

-- Splits (value in Moola, quantity in account commodity)
-- Alice: -10 Moola
INSERT INTO splits VALUES('00000000000000000000000000000050','00000000000000000000000000000040','00000000000000000000000000000100','','','c',NULL,-10,1,-10,1,NULL);
-- Alice: +1 Stock (value=10 Moola, quantity=1 Stock)
INSERT INTO splits VALUES('00000000000000000000000000000051','00000000000000000000000000000040','00000000000000000000000000000101','','','c',NULL,10,1,1,1,NULL);
-- Bob: +10 Moola
INSERT INTO splits VALUES('00000000000000000000000000000052','00000000000000000000000000000040','00000000000000000000000000000200','','','c',NULL,10,1,10,1,NULL);
-- Bob: -1 Stock (value=-10 Moola, quantity=-1 Stock)
INSERT INTO splits VALUES('00000000000000000000000000000053','00000000000000000000000000000040','00000000000000000000000000000201','','','c',NULL,-10,1,-1,1,NULL);

COMMIT;
