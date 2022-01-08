update accounts_load
set commodity_guid = (select commodity_guid from accounts where name = 'Assets')
, commodity_scu = (select commodity_scu from accounts where name = 'Assets')
, non_std_scu = (select non_std_scu from accounts where name = 'Assets')
;

-- delete from accounts;
insert into accounts select * from accounts_load;

update transactions_load
set num = ''
  , currency_guid = (select guid from commodities where mnemonic = 'USD');


-- delete from transactions;
insert into transactions select * from transactions_load;

update splits_load
set memo=''
  , action=''
  , reconcile_state='n'
  , quantity_num = value_num
  , quantity_denom = value_denom;


-- delete from splits;
insert into splits select * from splits_load;

