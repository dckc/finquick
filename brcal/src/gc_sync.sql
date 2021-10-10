-- Lunch Money

select * from slots where name = 'lunchmoney.app/categories';

-- delete from slots where name like 'lunchmoney.app/transactions';

-- Home -> House
-- ISSUE: importSlots assumes records don't change. hm.
-- delete from slots where name = 'lunchmoney.app/categories' and string_val like '%"Home"%';
-- delete from slots where name = 'lunchmoney.app/categories' and string_val like '%"Education"%';

drop table if exists lm_categories ;

-- odd! views don't seem to work well.
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
  , timestamp(replace(replace(data->>"$.updated_at", 'T', ' '), 'Z', '')) updated_at
  , timestamp(replace(replace(data->>"$.created_at", 'T', ' '), 'Z', '')) created_at
  -- , json_type(data->>"$.is_group") ty
  , data->>"$.is_group" = 'true' is_group
  , data->>"$.group_id" group_id
  , data
from (
	select id, obj_guid, name
	     , case when JSON_VALID(string_val) = 1 then cast(string_val as json) end data
	from slots
	where name = 'lunchmoney.app/categories'
) detail
;


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
	select id, obj_guid, name
	     , case when JSON_VALID(string_val) = 1 then cast(string_val as json) end data
	from slots
	where name = 'lunchmoney.app/transactions'
) detail
order by date
;

create table lm_assets as
select
    obj_guid guid
  , data->>"$.id" id
  , data->>"$.name" name
  , data->>"$.balance" + 0 balance
  -- currency, closed_on
  , data->>"$.type_name" type_name
  -- created_at
  , timestamp(replace(replace(data->>"$.balance_as_of", 'T', ' '), 'Z', '')) balance_as_of
  -- institution_name
  , data
from (
	select id, obj_guid, name
	     , case when JSON_VALID(string_val) = 1 then cast(string_val as json) end data
	from slots
	where name = 'lunchmoney.app/assets'
) detail
;

drop table lm_plaid_accounts;
create table lm_plaid_accounts as
select
    obj_guid guid
  , data->>"$.id" id
  , data->>"$.name" name
  , data->>"$.display_name" display_name
  , data->>"$.balance" + 0 balance
  , data->>"$.type" type
  , data->>"$.subtype" subtype
  , timestamp(replace(replace(data->>"$.balance_last_update", 'T', ' '), 'Z', '')) balance_last_update
  -- mask, ...
  , data
from (
	select id, obj_guid, name
	     , case when JSON_VALID(string_val) = 1 then cast(string_val as json) end data
	from slots
	where name = 'lunchmoney.app/plaid_accounts'
) detail
;
select * from lm_plaid_accounts;

create or replace view lm_detail as
select tx.date, tx.payee, tx.amount, tx.notes
     , tx.category_id, cat.name category_name
     , coalesce(pa.id, a.id) account_id, coalesce(pa.display_name, pa.name, a.name) account_name
     , tx.is_group, tx.parent_id
from lm_tx tx
left join lm_assets a on a.id = tx.asset_id
left join lm_plaid_accounts pa on pa.id = tx.plaid_account_id
left join lm_categories cat on cat.id = tx.category_id
order by tx.date
;
select * from lm_detail
where account_id = 23125
;

select * from split_detail;

select account_id, account_name, sum(amount) from lm_detail
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

select * from slots where name = 'lunchmoney.app/assets';
select * from slots where name = 'lunchmoney.app/plaid_accounts';
select * from slots where name = 'lunchmoney.app/transactions';
