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

drop view account_tree;

-- acctTree:
create view account_tree as
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
select guid, path, hidden from rel
;

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

-- hiddenSync
select * from (
select guid, account_type, name
     , date(min(post_date)) date_lo, date(max(post_date)) date_hi
     , hidden
     , 2022 - (0 + strftime('%Y', max(post_date))) age
from (
select acct.guid, acct.account_type, acct.name, acct.hidden , tx.post_date
from accounts acct
join splits s on s.account_guid = acct.guid
join transactions tx on tx.guid = s.tx_guid
)
group by guid, name, account_type, hidden
)
where ((hidden = 1 and age < 1) OR
       (hidden = 0 and age > 1))
order by hidden, age, account_type, name
;

-- incomeStatement:
with period as (select '2022-01-01' as lo, '2022-03-31' as hi)
, acct as (select account_type, code, guid from accounts where account_type in ('INCOME', 'EXPENSE'))
, tx as (select post_date, guid from transactions join period where date(post_date) between lo and hi)
, split as (
  select tx_guid, account_guid, code, account_type, s.value_num * -1.0 / s.value_denom value from splits s
  join tx on s.tx_guid = tx.guid
  join acct on s.account_guid = acct.guid
)
, by_acct as (
select account_type, code, a.path, sum(value) income
from split join account_tree a on split.account_guid = a.guid
group by split.account_guid
)
, by_type as (
  select account_type, null, 'Total:', sum(income)
  from by_acct
  group by account_type
)
, net_income as (
  select lo || ' - ' || hi, null, 'Net Income', sum(income)
  from by_acct join period
)
select 1 o, a.* from by_acct a where account_type = 'INCOME'
union all
select 2 o, t.* from by_type t where account_type = 'INCOME'
union all
select 3 o, a.* from by_acct a where account_type = 'EXPENSE'
union all
select 4 o, t.* from by_type t where account_type = 'EXPENSE'
union ALL
select 5 o, n.* from net_income n
order by o, path
;
