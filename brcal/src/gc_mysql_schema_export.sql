
-- column info for each table: postion, name, type
select tb.table_schema, tb.table_name
     , col.ORDINAL_POSITION, col.COLUMN_NAME 
     , col.IS_NULLABLE , col.DATA_TYPE
     , col.CHARACTER_MAXIMUM_LENGTH, col.NUMERIC_PRECISION , col.NUMERIC_SCALE 
     , col.COLUMN_TYPE 
     , col.column_key
from information_schema.tables tb
join information_schema.COLUMNS col
on tb.TABLE_SCHEMA =col.TABLE_SCHEMA  and tb.table_name = col.table_name
where tb.table_schema != 'information_schema'
and tb.table_type != 'VIEW'
order by tb.create_time, tb.table_name, col.ordinal_position
;

-- include row count, update_time to confirm sync
select tb.table_schema
     , tb.table_name, tb.table_type
     , tb.table_rows, tb.create_time, tb.update_time
     , col.ORDINAL_POSITION, col.COLUMN_NAME 
     , col.IS_NULLABLE , col.DATA_TYPE
     , col.CHARACTER_MAXIMUM_LENGTH, col.NUMERIC_PRECISION , col.NUMERIC_SCALE 
     , col.COLUMN_TYPE 
     , col.column_key
from information_schema.tables tb
join information_schema.COLUMNS col
on tb.TABLE_SCHEMA =col.TABLE_SCHEMA  and tb.table_name = col.table_name
where tb.table_schema != 'information_schema'
and tb.table_type != 'VIEW'
order by tb.create_time, tb.table_name, col.ordinal_position
;
