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

-- updateSplitAccounts:
update splits set account_guid = (select guid from accounts where code = ?)
where tx_guid = ? and account_guid = (select guid from accounts where name = 'Imbalance-USD');


-- createSlotImport:
create table slot_import as
select string_val id, name, string_val from slots where 1 = 0;

-- loadSlotImport:
insert into slot_import (id, name, string_val)
values ?;

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
update slots sl
join slot_import si on md5(si.id) = sl.obj_guid and si.name = sl.name
set sl.string_val = si.string_val
;

-- dropSlotImport:
drop table if exists slot_import;
