PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE gnclock ( Hostname varchar(255), PID int );
CREATE TABLE versions (table_name text(50) PRIMARY KEY NOT NULL, table_version integer NOT NULL);
INSERT INTO "versions" VALUES('Gnucash',2041000);
INSERT INTO "versions" VALUES('Gnucash-Resave',19920);
INSERT INTO "versions" VALUES('accounts',1);
INSERT INTO "versions" VALUES('books',1);
INSERT INTO "versions" VALUES('budgets',1);
INSERT INTO "versions" VALUES('budget_amounts',1);
INSERT INTO "versions" VALUES('commodities',1);
INSERT INTO "versions" VALUES('lots',2);
INSERT INTO "versions" VALUES('prices',2);
INSERT INTO "versions" VALUES('schedxactions',1);
INSERT INTO "versions" VALUES('transactions',3);
INSERT INTO "versions" VALUES('splits',4);
INSERT INTO "versions" VALUES('billterms',2);
INSERT INTO "versions" VALUES('customers',2);
INSERT INTO "versions" VALUES('employees',2);
INSERT INTO "versions" VALUES('entries',3);
INSERT INTO "versions" VALUES('invoices',3);
INSERT INTO "versions" VALUES('jobs',1);
INSERT INTO "versions" VALUES('orders',1);
INSERT INTO "versions" VALUES('taxtables',2);
INSERT INTO "versions" VALUES('taxtable_entries',3);
INSERT INTO "versions" VALUES('vendors',1);
INSERT INTO "versions" VALUES('recurrences',1);
INSERT INTO "versions" VALUES('slots',3);
CREATE TABLE accounts (guid text(32) PRIMARY KEY NOT NULL, name text(2048) NOT NULL, account_type text(2048) NOT NULL, commodity_guid text(32), commodity_scu integer NOT NULL, non_std_scu integer NOT NULL, parent_guid text(32), code text(2048), description text(2048), hidden integer, placeholder integer);
INSERT INTO "accounts" VALUES('d49cd71c29bdbff92d8e367eac57de8b','Root Account','ROOT',NULL,0,0,NULL,'','',0,0);
INSERT INTO "accounts" VALUES('19792a8dd8fd4f16c0158b4de552cee4','Assets','ASSET','a3dd96c5b9f860b3450f81c698f77a43',100,0,'d49cd71c29bdbff92d8e367eac57de8b','','Assets',0,1);
INSERT INTO "accounts" VALUES('b8ab261e3dbfe6414dbb1ce8e7145c0f','Current Assets','ASSET','a3dd96c5b9f860b3450f81c698f77a43',100,0,'19792a8dd8fd4f16c0158b4de552cee4','','Current Assets',0,1);
INSERT INTO "accounts" VALUES('ae83e57371090710eadca6ccce87973c','Checking Account','BANK','a3dd96c5b9f860b3450f81c698f77a43',100,0,'b8ab261e3dbfe6414dbb1ce8e7145c0f','','Checking Account',0,0);
INSERT INTO "accounts" VALUES('84c3f3ecc927c94c3ed25a43fcbcf1cf','Income','INCOME','a3dd96c5b9f860b3450f81c698f77a43',100,0,'d49cd71c29bdbff92d8e367eac57de8b','','Income',0,0);
INSERT INTO "accounts" VALUES('6eed7744d2235d1e52a129afa07e14e5','Expenses','EXPENSE','a3dd96c5b9f860b3450f81c698f77a43',100,0,'d49cd71c29bdbff92d8e367eac57de8b','','Expenses',0,0);
INSERT INTO "accounts" VALUES('41086c9b72a30c66492ae831005b9def','Equity','EQUITY','a3dd96c5b9f860b3450f81c698f77a43',100,0,'d49cd71c29bdbff92d8e367eac57de8b','','Equity',0,1);
INSERT INTO "accounts" VALUES('704098c80338b21c8a415f75cc5271c9','Opening Balances','EQUITY','a3dd96c5b9f860b3450f81c698f77a43',100,0,'41086c9b72a30c66492ae831005b9def','','Opening Balances',0,0);
INSERT INTO "accounts" VALUES('5f6f2eb7bf4242972cf2912ea5e42c1e','Template Root','ROOT',NULL,0,0,NULL,'','',0,0);
CREATE TABLE books (guid text(32) PRIMARY KEY NOT NULL, root_account_guid text(32) NOT NULL, root_template_guid text(32) NOT NULL);
INSERT INTO "books" VALUES('c6e2c4179fa33566f6544be3ca0bf55a','d49cd71c29bdbff92d8e367eac57de8b','5f6f2eb7bf4242972cf2912ea5e42c1e');
CREATE TABLE budgets (guid text(32) PRIMARY KEY NOT NULL, name text(2048) NOT NULL, description text(2048), num_periods integer NOT NULL);
CREATE TABLE budget_amounts (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, budget_guid text(32) NOT NULL, account_guid text(32) NOT NULL, period_num integer NOT NULL, amount_num bigint NOT NULL, amount_denom bigint NOT NULL);
CREATE TABLE commodities (guid text(32) PRIMARY KEY NOT NULL, namespace text(2048) NOT NULL, mnemonic text(2048) NOT NULL, fullname text(2048), cusip text(2048), fraction integer NOT NULL, quote_flag integer NOT NULL, quote_source text(2048), quote_tz text(2048));
INSERT INTO "commodities" VALUES('a3dd96c5b9f860b3450f81c698f77a43','CURRENCY','USD','US Dollar','840',100,1,'currency','');
CREATE TABLE lots (guid text(32) PRIMARY KEY NOT NULL, account_guid text(32), is_closed integer NOT NULL);
CREATE TABLE prices (guid text(32) PRIMARY KEY NOT NULL, commodity_guid text(32) NOT NULL, currency_guid text(32) NOT NULL, date text(14) NOT NULL, source text(2048), type text(2048), value_num bigint NOT NULL, value_denom bigint NOT NULL);
CREATE TABLE schedxactions (guid text(32) PRIMARY KEY NOT NULL, name text(2048), enabled integer NOT NULL, start_date text(8), end_date text(8), last_occur text(8), num_occur integer NOT NULL, rem_occur integer NOT NULL, auto_create integer NOT NULL, auto_notify integer NOT NULL, adv_creation integer NOT NULL, adv_notify integer NOT NULL, instance_count integer NOT NULL, template_act_guid text(32) NOT NULL);
CREATE TABLE transactions (guid text(32) PRIMARY KEY NOT NULL, currency_guid text(32) NOT NULL, num text(2048) NOT NULL, post_date text(14), enter_date text(14), description text(2048));
INSERT INTO "transactions" VALUES('0cec621553d45e4183fa7711415ad0c4','a3dd96c5b9f860b3450f81c698f77a43','','20110401050000','20120423040210','ACME Widgets');
INSERT INTO "transactions" VALUES('edc47b30821d2bad6d473ecd2e900e0d','a3dd96c5b9f860b3450f81c698f77a43','1001','20110405050000','20120423040324','Groceries');
INSERT INTO "transactions" VALUES('1533d4d9e91fec720915fe287bf10868','a3dd96c5b9f860b3450f81c698f77a43','','20110501050000','20120423040509','ACME Widgets');
INSERT INTO "transactions" VALUES('19eb4bb7c03cb0162a278e1091648682','a3dd96c5b9f860b3450f81c698f77a43','1002','20110415050000','20120423040529','Rent');
INSERT INTO "transactions" VALUES('3f2c620024c7fa0f337db6e0341a263f','a3dd96c5b9f860b3450f81c698f77a43','','20110420050000','20120423040543','Groceries');
CREATE TABLE splits (guid text(32) PRIMARY KEY NOT NULL, tx_guid text(32) NOT NULL, account_guid text(32) NOT NULL, memo text(2048) NOT NULL, action text(2048) NOT NULL, reconcile_state text(1) NOT NULL, reconcile_date text(14), value_num bigint NOT NULL, value_denom bigint NOT NULL, quantity_num bigint NOT NULL, quantity_denom bigint NOT NULL, lot_guid text(32));
INSERT INTO "splits" VALUES('df09b0f44e1bb465a6740ac2815eddf8','0cec621553d45e4183fa7711415ad0c4','ae83e57371090710eadca6ccce87973c','','','y','20110501045959',100000,100,100000,100,NULL);
INSERT INTO "splits" VALUES('9d5ebc9638eadd27e34b9610131926ed','0cec621553d45e4183fa7711415ad0c4','84c3f3ecc927c94c3ed25a43fcbcf1cf','','','n',NULL,-100000,100,-100000,100,NULL);
INSERT INTO "splits" VALUES('e168a0a5fe9efd17fc117b038230b115','edc47b30821d2bad6d473ecd2e900e0d','ae83e57371090710eadca6ccce87973c','','','y','20110501045959',-15000,100,-15000,100,NULL);
INSERT INTO "splits" VALUES('39c01c524c347b42ff39a7c00a673640','edc47b30821d2bad6d473ecd2e900e0d','6eed7744d2235d1e52a129afa07e14e5','','','n',NULL,15000,100,15000,100,NULL);
INSERT INTO "splits" VALUES('fb33077de206d6288f11c5ec77a7e1dd','1533d4d9e91fec720915fe287bf10868','ae83e57371090710eadca6ccce87973c','','','n',NULL,100000,100,100000,100,NULL);
INSERT INTO "splits" VALUES('47eac9f25ce1515b3eaf53c8a2806554','1533d4d9e91fec720915fe287bf10868','84c3f3ecc927c94c3ed25a43fcbcf1cf','','','n',NULL,-100000,100,-100000,100,NULL);
INSERT INTO "splits" VALUES('56638f439614bc7d2a79759d19e9820f','19eb4bb7c03cb0162a278e1091648682','ae83e57371090710eadca6ccce87973c','','','y','20110501045959',-50000,100,-50000,100,NULL);
INSERT INTO "splits" VALUES('fedd4f2abf95c8e2837e92b6fe0780d7','19eb4bb7c03cb0162a278e1091648682','6eed7744d2235d1e52a129afa07e14e5','','','n',NULL,50000,100,50000,100,NULL);
INSERT INTO "splits" VALUES('0ba10ed14df9a583fa2d0c513bc6f60e','3f2c620024c7fa0f337db6e0341a263f','ae83e57371090710eadca6ccce87973c','','','y','20110501045959',-15000,100,-15000,100,NULL);
INSERT INTO "splits" VALUES('c61f658a26d5599e6022c6e0112ad1ef','3f2c620024c7fa0f337db6e0341a263f','6eed7744d2235d1e52a129afa07e14e5','','','n',NULL,15000,100,15000,100,NULL);
CREATE TABLE billterms (guid text(32) PRIMARY KEY NOT NULL, name text(2048) NOT NULL, description text(2048) NOT NULL, refcount integer NOT NULL, invisible integer NOT NULL, parent text(32), type text(2048) NOT NULL, duedays integer, discountdays integer, discount_num bigint, discount_denom bigint, cutoff integer);
CREATE TABLE customers (guid text(32) PRIMARY KEY NOT NULL, name text(2048) NOT NULL, id text(2048) NOT NULL, notes text(2048) NOT NULL, active integer NOT NULL, discount_num bigint NOT NULL, discount_denom bigint NOT NULL, credit_num bigint NOT NULL, credit_denom bigint NOT NULL, currency text(32) NOT NULL, tax_override integer NOT NULL, addr_name text(1024), addr_addr1 text(1024), addr_addr2 text(1024), addr_addr3 text(1024), addr_addr4 text(1024), addr_phone text(128), addr_fax text(128), addr_email text(256), shipaddr_name text(1024), shipaddr_addr1 text(1024), shipaddr_addr2 text(1024), shipaddr_addr3 text(1024), shipaddr_addr4 text(1024), shipaddr_phone text(128), shipaddr_fax text(128), shipaddr_email text(256), terms text(32), tax_included integer, taxtable text(32));
CREATE TABLE employees (guid text(32) PRIMARY KEY NOT NULL, username text(2048) NOT NULL, id text(2048) NOT NULL, language text(2048) NOT NULL, acl text(2048) NOT NULL, active integer NOT NULL, currency text(32) NOT NULL, ccard_guid text(32), workday_num bigint NOT NULL, workday_denom bigint NOT NULL, rate_num bigint NOT NULL, rate_denom bigint NOT NULL, addr_name text(1024), addr_addr1 text(1024), addr_addr2 text(1024), addr_addr3 text(1024), addr_addr4 text(1024), addr_phone text(128), addr_fax text(128), addr_email text(256));
CREATE TABLE entries (guid text(32) PRIMARY KEY NOT NULL, date text(14) NOT NULL, date_entered text(14), description text(2048), action text(2048), notes text(2048), quantity_num bigint, quantity_denom bigint, i_acct text(32), i_price_num bigint, i_price_denom bigint, i_discount_num bigint, i_discount_denom bigint, invoice text(32), i_disc_type text(2048), i_disc_how text(2048), i_taxable integer, i_taxincluded integer, i_taxtable text(32), b_acct text(32), b_price_num bigint, b_price_denom bigint, bill text(32), b_taxable integer, b_taxincluded integer, b_taxtable text(32), b_paytype integer, billable integer, billto_type integer, billto_guid text(32), order_guid text(32));
CREATE TABLE invoices (guid text(32) PRIMARY KEY NOT NULL, id text(2048) NOT NULL, date_opened text(14), date_posted text(14), notes text(2048) NOT NULL, active integer NOT NULL, currency text(32) NOT NULL, owner_type integer, owner_guid text(32), terms text(32), billing_id text(2048), post_txn text(32), post_lot text(32), post_acc text(32), billto_type integer, billto_guid text(32), charge_amt_num bigint, charge_amt_denom bigint);
CREATE TABLE jobs (guid text(32) PRIMARY KEY NOT NULL, id text(2048) NOT NULL, name text(2048) NOT NULL, reference text(2048) NOT NULL, active integer NOT NULL, owner_type integer, owner_guid text(32));
CREATE TABLE orders (guid text(32) PRIMARY KEY NOT NULL, id text(2048) NOT NULL, notes text(2048) NOT NULL, reference text(2048) NOT NULL, active integer NOT NULL, date_opened text(14) NOT NULL, date_closed text(14) NOT NULL, owner_type integer NOT NULL, owner_guid text(32) NOT NULL);
CREATE TABLE taxtables (guid text(32) PRIMARY KEY NOT NULL, name text(50) NOT NULL, refcount bigint NOT NULL, invisible integer NOT NULL, parent text(32));
CREATE TABLE taxtable_entries (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, taxtable text(32) NOT NULL, account text(32) NOT NULL, amount_num bigint NOT NULL, amount_denom bigint NOT NULL, type integer NOT NULL);
CREATE TABLE vendors (guid text(32) PRIMARY KEY NOT NULL, name text(2048) NOT NULL, id text(2048) NOT NULL, notes text(2048) NOT NULL, currency text(32) NOT NULL, active integer NOT NULL, tax_override integer NOT NULL, addr_name text(1024), addr_addr1 text(1024), addr_addr2 text(1024), addr_addr3 text(1024), addr_addr4 text(1024), addr_phone text(128), addr_fax text(128), addr_email text(256), terms text(32), tax_inc text(2048), tax_table text(32));
CREATE TABLE recurrences (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, obj_guid text(32) NOT NULL, recurrence_mult integer NOT NULL, recurrence_period_type text(2048) NOT NULL, recurrence_period_start text(8) NOT NULL);
CREATE TABLE slots (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, obj_guid text(32) NOT NULL, name text(4096) NOT NULL, slot_type integer NOT NULL, int64_val bigint, string_val text(4096), double_val float8, timespec_val text(14), guid_val text(32), numeric_val_num bigint, numeric_val_denom bigint, gdate_val text(8));
INSERT INTO "slots" VALUES(1,'19792a8dd8fd4f16c0158b4de552cee4','placeholder',4,0,'true',0.0,NULL,NULL,0,1,NULL);
INSERT INTO "slots" VALUES(2,'b8ab261e3dbfe6414dbb1ce8e7145c0f','placeholder',4,0,'true',0.0,NULL,NULL,0,1,NULL);
INSERT INTO "slots" VALUES(3,'41086c9b72a30c66492ae831005b9def','placeholder',4,0,'true',0.0,NULL,NULL,0,1,NULL);
INSERT INTO "slots" VALUES(8,'0cec621553d45e4183fa7711415ad0c4','date-posted',10,0,NULL,0.0,NULL,NULL,0,1,'20110401');
INSERT INTO "slots" VALUES(9,'edc47b30821d2bad6d473ecd2e900e0d','date-posted',10,0,NULL,0.0,NULL,NULL,0,1,'20110405');
INSERT INTO "slots" VALUES(17,'19eb4bb7c03cb0162a278e1091648682','date-posted',10,0,NULL,0.0,NULL,NULL,0,1,'20110415');
INSERT INTO "slots" VALUES(18,'3f2c620024c7fa0f337db6e0341a263f','date-posted',10,0,NULL,0.0,NULL,NULL,0,1,'20110420');
INSERT INTO "slots" VALUES(19,'3f2c620024c7fa0f337db6e0341a263f','notes',4,0,'',0.0,NULL,NULL,0,1,NULL);
INSERT INTO "slots" VALUES(20,'1533d4d9e91fec720915fe287bf10868','date-posted',10,0,NULL,0.0,NULL,NULL,0,1,'20110501');
INSERT INTO "slots" VALUES(21,'1533d4d9e91fec720915fe287bf10868','notes',4,0,'',0.0,NULL,NULL,0,1,NULL);
INSERT INTO "slots" VALUES(28,'ae83e57371090710eadca6ccce87973c','last-num',4,0,'1002',0.0,NULL,NULL,0,1,NULL);
INSERT INTO "slots" VALUES(29,'ae83e57371090710eadca6ccce87973c','reconcile-info',9,0,NULL,0.0,NULL,'198fd7420915da91860ce83703e6347d',0,1,NULL);
INSERT INTO "slots" VALUES(30,'198fd7420915da91860ce83703e6347d','reconcile-info/last-date',1,1304225999,NULL,0.0,NULL,NULL,0,1,NULL);
INSERT INTO "slots" VALUES(31,'198fd7420915da91860ce83703e6347d','reconcile-info/include-children',1,0,NULL,0.0,NULL,NULL,0,1,NULL);
CREATE TABLE ofx_stmttrn (
	fitid VARCHAR(80) NOT NULL, 
	checknum VARCHAR(80), 
	dtposted DATETIME NOT NULL, 
	memo VARCHAR(80), 
	name VARCHAR(80) NOT NULL, 
	payeeid VARCHAR(80), 
	trnamt INTEGER NOT NULL, 
	trntype VARCHAR(80), 
	match_guid VARCHAR(32), 
	PRIMARY KEY (fitid)
);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" VALUES('slots',32);
CREATE INDEX tx_post_date_index ON transactions (post_date);
CREATE INDEX splits_tx_guid_index ON splits (tx_guid);
CREATE INDEX splits_account_guid_index ON splits (account_guid);
CREATE INDEX slots_guid_index ON slots (obj_guid);
COMMIT;
