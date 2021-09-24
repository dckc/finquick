-- Lunch Money

select * from slots where name = 'lunchmoney.app/categories';

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