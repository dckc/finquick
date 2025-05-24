// cribbed from https://github.com/ratboy666/qjs-sqlite3/blob/master/test.js
import { sqlite3_db } from '../build/sqlite3.so';

const db = new sqlite3_db(':memory:');
const st = db.prepare('select 1+1 as two');

for (let s = st.step(); s === 'row'; s = st.step()) {
  print('col 0:', st.column_value(0));
}
