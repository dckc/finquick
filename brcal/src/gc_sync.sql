-- Lunch Money

-- delete from slots where name like 'lunchmoney.app/transactions';
select * from slots where name = 'lunchmoney.app/categories';
select * from slots where name = 'lunchmoney.app/assets';
select * from slots where name = 'lunchmoney.app/plaid_accounts';
select * from slots where name = 'lunchmoney.app/transactions';

-- Home -> House
-- delete from slots where name = 'lunchmoney.app/categories' and string_val like '%"Home"%';
-- delete from slots where name = 'lunchmoney.app/categories' and string_val like '%"Education"%';


-- odd! views don't seem to work well.
drop table if exists lm_categories ;
drop view if exists lm_categories ;
create table lm_categories as
select
    obj_guid guid
-- https://lunchmoney.dev/#categories
  , data->>"$.id" id
  , data->>"$.name" name
  , data->>"$.description" description
  , data->>"$.is_income" = 'true' as is_income
  -- exclude_from_budget
  -- exclude_from_totals
  , replace(replace(data->>"$.updated_at", 'T', ' '), 'Z', '') updated_at
  , replace(replace(data->>"$.created_at", 'T', ' '), 'Z', '') created_at
  -- , json_type(data->>"$.is_group") ty
  , data->>"$.is_group" = 'true' is_group
  , data->>"$.group_id" group_id
  , ax.name account_name
  , ax.guid account_guid
  , ax.account_type
  , ax.code
  , data
from (
	select id, obj_guid, name
	     , string_val as data
	from slots
	where name = 'lunchmoney.app/categories'
	and json_valid(string_val)
) detail
left join (
  select a.guid, string_val, a.code, a.name, a.account_type
       , s.name slot_name
       , replace(string_val, 'lm:', '') + 0 lm
  from slots s join accounts a on a.guid = s.obj_guid
  where s.string_val like 'lm:%'
) ax
on data->>"$.id" = ax.lm
;
select * from lm_categories where account_guid is not null;


-- Lunch Money Transactions
drop table lm_tx;
create table lm_tx as
select
    obj_guid guid
-- https://lunchmoney.dev/#categories
  , data->>"$.id" id
  , data->>"$.date" date
  -- fees, tags, type
  , data->>"$.payee" payee
  -- price
  , data->>"$.amount" + 0 amount
  -- status, subtype
  , data->>"$.notes" notes
  , data->>"$.asset_id" asset_id
  , data->>"$.group_id" group_id
  , data->>"$.is_group" is_group
  , data->>"$.parent_id" parent_id
  , data->>"$.recurring_id" recurring_id
  , data->>"$.category_id" category_id
  , data->>"$.external_id" external_id
  -- currency
  -- quantity,
  -- , original_name
  , data->>"$.plaid_account_id" plaid_account_id
  -- , data
from (
	select id, obj_guid, name, JSON_VALID(string_val) json_ok
	     , string_val as data
	from slots
	where name = 'lunchmoney.app/transactions'
) detail
order by date
;

drop table if exists lm_assets;
create table lm_assets as
select
    obj_guid guid
  , data->>"$.id" id
  , data->>"$.name" name
  , data->>"$.balance" + 0 balance
  -- currency, closed_on
  , data->>"$.type_name" type_name
  -- created_at
  , replace(replace(data->>"$.balance_as_of", 'T', ' '), 'Z', '') balance_as_of
  -- institution_name
  , data
from (
	select id, obj_guid, name, JSON_VALID(string_val) json_ok
	     , string_val as data
	from slots
	where name = 'lunchmoney.app/assets'
) detail
;

drop table if exists lm_plaid_accounts;
create table lm_plaid_accounts as
select
    detail.obj_guid guid
  , data->>"$.id" id
  , data->>"$.name" name
  , data->>"$.display_name" display_name
  , data->>"$.balance" + 0 balance
  , data->>"$.type" type
  , data->>"$.subtype" subtype
  , replace(replace(data->>"$.balance_last_update", 'T', ' '), 'Z', '') balance_last_update
  -- mask, ...
  , ax.guid account_guid
  , ax.name account_name
  , ax.account_type
  , data
from (
	select id, obj_guid, name, JSON_VALID(string_val) json_ok
	     , string_val as data
	from slots
	where name = 'lunchmoney.app/plaid_accounts'
) detail
left join (
  select a.guid, string_val, a.name, a.account_type, cast(replace(string_val, 'lm:', '') as int) lm
  from slots s join accounts a on a.guid = s.obj_guid
  where s.string_val like 'lm:%'
) ax
on data->>"$.id" = ax.lm
;
select * from lm_plaid_accounts;

drop view if exists lm_detail;
create view lm_detail as
select tx.date, tx.payee, tx.amount, tx.notes
     , tx.category_id, cat.name category_name, cat.code, cat.account_guid cat_guid
     , coalesce(pa.id, a.id) account_id, coalesce(pa.display_name, pa.name, a.name) account_name
     , pa.account_guid
     , tx.id
     , tx.is_group, tx.parent_id
from lm_tx tx
left join lm_assets a on a.id = tx.asset_id
left join lm_plaid_accounts pa on pa.id = tx.plaid_account_id
left join lm_categories cat on cat.id = tx.category_id
order by tx.date
;
select * from lm_detail
-- where account_id = 23125 -- coinbase
where account_id = 43212 -- Discover
and cat_guid is not null
;

select * from split_detail;

select account_id, account_name, count(*) qty, sum(amount) from lm_detail
group by account_id, account_name
;



select * from slots where name = 'lunchmoney.app/plaid_accounts';

-- Do all GNUCash top-level budget categories have a corresponding Lunch Money category group?
-- ISSUE: leave TX, MBill, AIE behind?
select gc.parent, gc.name, gc.code, gc.hidden, lm.* from (
	select a.*, root.name parent
	from accounts a
	join (
	  select guid, name, parent_guid from accounts
	  where (parent_guid is null and name like 'Root%')
	  or (name in ('EB'))
	) root on a.parent_guid = root.guid
	where account_type in ('INCOME', 'EXPENSE')
) gc
left join (
	select * from lm_categories
	where is_group = 1
) lm
on lm.name = gc.name
order by gc.hidden, gc.code
;

select * from lm_detail where cat_guid is not null and account_guid is not null;

-- Sync Discover between Lunch Money and GnuCash
create view tx_split as
	select post_date, tx.guid tx_guid
	     , sa.guid split_guid, sa.account_guid, sa.value_num / sa.value_denom amount
	from transactions tx
	join splits sa on sa.tx_guid = tx.guid
	where tx.post_date >= '2021-07-01'
;

-- createLunchMoneyGnuCashSync:
create table lm_gc_sync as
select ga.tx_guid
     , lm.*
from lm_detail lm
join tx_split ga on ga.account_guid = lm.account_guid and date(ga.post_date) = lm.date and ga.amount = -lm.amount 
join accounts gc on gc.guid = lm.cat_guid
where lm.date >= '2021-07-01'
order by lm.date desc
;
select * from lm_gc_sync;

drop view if exists lm_gc_sync_match;
create view lm_gc_sync_match as
select sd.*
     , x.amount, cast(sd.amount as number) = x.amount amt_same
     , x.id, x.payee, x.notes, x.category_name, x.cat_guid
from split_detail sd
join lm_gc_sync x on x.tx_guid = sd.tx_guid and cast(sd.amount as number) = x.amount
where sd.path = 'Imbalance-USD';
select * from lm_gc_sync_match ;

-- IDEA: feed online_id back to lunchmoney? hm. are transactions from plaid accounts editable?

-- previewUpdateUnCat
select *
from splits s
join lm_gc_sync_match x on s.guid = x.guid
;

-- TODO: sync pay, notes

-- updateUnCat:
update splits s
join lm_gc_sync_match x on s.guid = x.guid
set s.account_guid = x.cat_guid
;
