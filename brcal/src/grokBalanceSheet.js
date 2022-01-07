/* global Buffer */
const { fromEntries } = Object;
const range = n => [...Array(n).keys()];
const monthByName = fromEntries(
  range(12).map(m => [new Date(2000, m, 1).toDateString().slice(4, 7), m]),
);

const parseDate = txt => {
  const parts = txt.match(/(\w+) (\d+), (\d+)/);
  if (!parts) throw RangeError(txt);
  const [_all, monthName, day, yr] = parts;
  const month = monthByName[monthName.slice(0, 3)];
  return new Date(parseInt(yr, 10), month, parseInt(day, 10));
};

async function read(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const main = async ({ stdin }) => {
  const txt = await read(stdin);
  console.log(txt.length);
  const lines = txt.split('\n');
  console.log(lines.slice(0, 10));
  const [org, report, asOf] = lines.slice(0, 3).map(l => l.trim());
  const reportDate = parseDate(asOf.replace('As of ', ''));
  console.log({ org, report, reportDate });
};

/* global require, module, process */
if (require.main === module) {
  main({ stdin: process.stdin }).catch(console.error);
}
