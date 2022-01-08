update accounts_load
set commodity_guid = (select commodity_guid from accounts where name = 'Assets')
, commodity_scu = (select commodity_scu from accounts where name = 'Assets')
, non_std_scu = (select non_std_scu from accounts where name = 'Assets')
;

insert into accounts select * from accounts_load;

update transactions_load
set num = ''
  , currency_guid = (select currency_guid from transactions where guid = 'f97ee762c03b47b5a9e1aacc9091effa');

insert into transactions select * from transactions_load;

update splits_load
set memo=''
  , action=''
  , reconcile_state='n'
  , quantity_num = value_num
  , quantity_denom = value_denom;


insert into splits select * from splits_load;
