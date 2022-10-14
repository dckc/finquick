-- split_detail in JSON with related stuff, incl. lunchmoney

drop table if exists acct_ancestors;

create table acct_ancestors as
select a0.guid a0guid, a1.guid a1guid, a2.guid a2guid,
       a3.guid a3guid, a4.guid a4guid,
 (coalesce((a4.name || ':'), '') ||
 coalesce((a3.name || ':'), '') ||
 coalesce((a2.name || ':'), '') ||
 coalesce((a1.name || ':'), '') ||
 a0.name) path,
 coalesce(a0.code, a1.code, a2.code, a3.code, a4.code) code,
 coalesce(a0.account_type, a1.account_type, a2.account_type,
          a3.account_type, a4.account_type) account_type
from accounts a0
join books on books.root_account_guid is not null
left join accounts a1
  on a0.parent_guid = a1.guid
 and a1.guid != books.root_account_guid
left join accounts a2
  on a1.parent_guid = a2.guid
 and a2.guid != books.root_account_guid
left join accounts a3
  on a2.parent_guid = a3.guid
 and a3.guid != books.root_account_guid
left join accounts a4
  on a3.parent_guid = a4.guid
 and a4.guid != books.root_account_guid
;
-- select * from acct_ancestors;

DROP VIEW IF EXISTS split_detail;
create view split_detail as
select tx.post_date, tx.description
     , (s.value_num / s.value_denom) as amount
     , s.memo
     , a.code
     , a.path
     , coalesce(slots.string_val,'') as online_id
     , s.guid as guid
     , tx.guid as tx_guid
from transactions tx
join splits s on s.tx_guid = tx.guid
join acct_ancestors a on s.account_guid = a.a0guid
left join slots on slots.obj_guid = s.guid and slots.name = 'online_id'
;
-- select * from split_detail order by post_date desc;

DROP VIEW IF EXISTS tx_json;
CREATE VIEW tx_json as
select post_date, json_object('date', SUBSTRING(post_date, 1, 10)
  , 'num', case when tx.num > '' then tx.num else null end
  , 'description', tx.description
  , 'splits', json_group_array(
  json_object('value', (value_num * 1.0 / value_denom),
              'code', a.code, 'account', a.path, 'type', a.account_type,
              'memo', memo,
              'online_id', slots.string_val,
              'split_guid', s.guid)
  )
  , 'post_date', tx.post_date, 'tx_guid', tx_guid) tx
from transactions tx
join splits s on s.tx_guid = tx.guid 
join acct_ancestors a on a.a0guid = s.account_guid 
left join slots on slots.obj_guid = s.guid and slots.name = 'online_id'
group by tx.guid
;

SELECT tx FROM tx_json ORDER BY post_date DESC;
