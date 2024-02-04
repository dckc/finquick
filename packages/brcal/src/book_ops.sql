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
with period as (select '2022-01-01' as lo, '2022-06-30' as hi)
, acct as (select account_type, code, guid from accounts where account_type in ('INCOME', 'EXPENSE'))
, tx as (select post_date, guid from transactions join period where date(post_date) >= lo and date(post_date) <= hi)
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

drop view if exists accounting_period;
create VIEW accounting_period as
select null lo, '2022-12-31' hi
union all
select null lo, '2023-12-31' hi
;
select * from accounting_period ;

drop view if exists asset_price;
create view asset_price as
with price_yr as (
  select substr(date, 1, 4) yr, 1.0 * value_num / value_denom price, date, commodity_guid , currency_guid  from prices
)
, price_ix as (
  select row_number() over (partition by yr, commodity_guid order by date desc) ix, price_yr.*
  from price_yr
)
select s.mnemonic symbol, c.mnemonic currency, p.*
from price_ix p
join commodities s on p.commodity_guid =s.guid
join commodities c on p.currency_guid  =c.guid
where ix = 1
and c.namespace ='CURRENCY' and c.mnemonic='USD'
order by symbol, yr
;

drop view if exists balance_by_acct;
create view balance_by_acct as
with s as (
	select date(tx.post_date) tx_date, tx.description
	     , 1.0 * value_num / value_denom value
	     , 1.0 * quantity_num / quantity_denom qty
	     , s.account_guid
	     -- , s.*
	from transactions tx
	join splits s on tx.guid = s.tx_guid
),
dur_acct as (
	select dur.hi, account_guid
	     , round(sum(qty), 4) qty
	     , count(tx_date) tx_ct
	     , round(sum(value), 2) value
	from accounting_period dur
	join s on s.tx_date <= dur.hi
	group by dur.hi, account_guid
)
select substr(da.hi, 1, 4) yr
     , case account_type
         when 'MUTUAL' then 'ASSET'
         when 'CREDIT' then 'LIABILITY'
         when 'BANK' then 'ASSET'
         when 'CASH' then 'ASSET'
         when 'RECEIVABLE' then 'ASSET'
         else account_type
       end account_type
     , tr.path
     , da.qty
     , case when ap.symbol is null then null else ap.symbol || '@' || round(ap.price, 4) end symbol
     , case when ap.symbol is null then qty else round(da.qty * ap.price, 2) end balance
     -- , da.*
from dur_acct da
join account_tree tr on tr.guid = account_guid
join accounts a on a.guid = account_guid
left join asset_price ap on a.commodity_guid = ap.commodity_guid and substr(da.hi, 1, 4) = ap.yr
where account_type not in ('INCOME', 'EXPENSE')
and da.qty != 0
order by da.hi, tr.path
;

select * from balance_by_acct order by yr, account_type, path;


-- balanceSheet:
with by_type as (
  select yr, account_type, 'Total ' || account_type account_type, null, null, round(sum(balance), 2)
  from balance_by_acct
  group by yr, account_type
)
, net_worth as (
  select yr, null, 'Net Worth', null, null, round(sum(balance), 2)
  from balance_by_acct
  where account_type in ('ASSET', 'LIABILITY')
  group by yr
)
select 1 o, a.* from balance_by_acct a where account_type = 'ASSET' and (balance < 0 or balance > 0)
union all
select 2 o, t.* from by_type t where account_type = 'ASSET'
union all
select 3 o, a.* from balance_by_acct a where account_type = 'LIABILITY' and balance != 0
union all
select 4 o, t.* from by_type t where account_type = 'LIABILITY'
union ALL
select 5 o, n.* from net_worth n
order by yr, o, path
;

-- TODO: 1099-B
-- Currency Name	Purchase Date	Cost Basis	Date Sold	Proceeds
-- but FIFO in SQL looks kinda tricky

-- BitCoin.Tax format
-- Date,Action,Account,Symbol,Volume,Price,Currency,Fee
-- 2020-01-01 13:00:00 -0800,BUY,Coinbase,BTC,1,500,USD,5.50

-- bitCoinTaxTradeExport:
with period as (select '2022-01-01' lo, '2022-12-31' as hi)
, tx as (select * from transactions tx join period where tx.post_date between lo and hi)
, asset as (
	select a.account_type, code, name, mnemonic, a.guid
	from accounts a
	join commodities c on a.commodity_guid = c.guid
	where c.mnemonic != 'USD'
)
, trade as (
select tx.post_date, tx.num, tx.description, a.name, a.mnemonic, s.action
     , 1.0 * value_num / value_denom value
     , 1.0 * quantity_num / quantity_denom quantity
from tx
join splits s on s.tx_guid = tx.guid
join asset a on s.account_guid = a.guid
where s.action in ('Buy', 'Sell')
)
select date(post_date) || ' ' || num 'Date'
     , case when action in ('Buy') then 'BUY'
       else 'SELL' end Action
     , name Account
     , mnemonic Symbol
     , abs(quantity) Volume
     , value / quantity Price
     , 'USD' Currency
     , description
from trade
order by post_date, num
;

-- Date,Action,Account,Symbol,Volume
-- 2020-01-01 13:00:00 -0800,INCOME,"Blockchain Wallet",BTC,1

-- bitCoinTaxIncomeExport:
with period as (select '2022-01-01' lo, '2022-12-31' as hi)
, tx as (select * from transactions tx join period where tx.post_date between lo and hi)
, asset as (
	select a.account_type, code, name, mnemonic, a.guid
	from accounts a
	join commodities c on a.commodity_guid = c.guid
	where c.mnemonic != 'USD'
)
, trade as (
select tx.post_date, tx.num, tx.description, a.name, a.mnemonic, s.action
     , 1.0 * value_num / value_denom value
     , 1.0 * quantity_num / quantity_denom quantity
from tx
join splits s on s.tx_guid = tx.guid
join asset a on s.account_guid = a.guid
where s.action in ('Grant', 'Claim')
)
select date(post_date) || ' ' || num 'Date'
     , case when action is 'Grant' then 'INCOME' else 'MINING' end Action
     , name Account
     , description Memo
     , mnemonic Symbol
     , abs(quantity) Volume
     , value Total
     , 'USD' Currency
from trade
order by post_date, num
;
