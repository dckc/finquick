-- uncat:
select date_format(uncat.post_date, '%Y-%m-%d') tx_date, uncat.description
     , uncat.amount, uncat.memo,
              trim(acct.memo) memo_acct, uncat.tx_guid
     , acct.path acct_path
     , acct.online_id
from (select * from split_detail where path = 'Imbalance-USD') uncat
join split_detail acct on acct.tx_guid = uncat.tx_guid
where acct.path != 'Imbalance-USD'
order by uncat.post_date;

-- categoriesSyncSheets:
with anc as (
with recursive
  rel(guid, parent_guid, parent_path, path, hidden) as (
  select guid, parent_guid, null, name, hidden from accounts
  where parent_guid in (select guid from accounts where parent_guid is null)
  union all
  select a.guid, a.parent_guid, rel.path, rel.path || ':' || a.name
       , case when rel.hidden = 1 or a.hidden = 1 then 1 else 0 end hidden
  from rel
  join accounts a on rel.guid = a.parent_guid
  )
select * from rel
)
select a.code, a.name `Category`, anc.parent_path `Group`
     , case a.account_type
       when 'EXPENSE' then 'Expense'
       when 'INCOME' then 'Income'
       when 'ASSET' then 'Transfer'
       end `Type`
from accounts a
join anc on a.guid = anc.guid
and parent_path is not null
and code > ''
and (
  a.account_type in ('INCOME', 'EXPENSE')
  or
  (a.account_type in ('ASSET') and anc.parent_path like 'AR%'))
and anc.hidden = 0
order by a.account_type, anc.parent_path, a.code
;

-- updateSplitAccounts:
update splits set account_guid = (select guid from accounts where code = ?)
where tx_guid = ? and account_guid = (select guid from accounts where name = 'Imbalance-USD');


-- createSlotImport:
create table slot_import as
select string_val id, name, string_val from slots where 1 = 0;

-- loadSlotImport:
insert into slot_import (id, name, string_val)
values (?, ?, ?);

-- insertSlotImport:
insert into slots (obj_guid, name, slot_type, string_val)
select md5(id), name, 4, string_val
from slot_import si
where not exists (
  select 1
  from slots sl
  where sl.name = si.name
  and sl.obj_guid = md5(si.id)
);

-- updateSlotImport:
update slots
set string_val = imp.string_val
from (
  select sl.id, si.string_val
  from slots sl
  join slot_import si on md5(si.id) = sl.obj_guid and si.name = sl.name
) imp
where slots.id = imp.id
;

-- dropSlotImport:
drop table if exists slot_import;
