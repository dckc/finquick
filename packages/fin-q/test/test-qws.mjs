import QuickWebServer from '../quickwebserver/src/QuickWebServer.js';
import { sqlite3_db } from '../build/sqlite3.so';

const db = new sqlite3_db(':memory');
const st = db.prepare('select 1+1 as two');
st.step();
const result = st.column_value(0);

const server = new QuickWebServer();

server.get('/', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({ result }));
});

server.listen(8080);
print('QWS server running at http://localhost:8080');
