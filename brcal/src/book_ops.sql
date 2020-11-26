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
