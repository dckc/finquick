/* eslint-disable no-cond-assign */
/* eslint-disable no-continue */
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

function* reportItems(lines) {
  const [org, report, asOf] = lines.slice(0, 3).map(l => l.trim());
  const reportDate = parseDate(asOf.replace('As of ', ''));
  yield { org, report, reportDate };

  let state = 'date-cols';
  let acctType;
  const acctPath = [];
  let detail;
  for (const line of lines.slice(3)) {
    if (line.trim() === '') continue;
    switch (state) {
      case 'date-cols': {
        const parts = line.match(
          /\s+(\w+) - (\w+), (\d+)\s+(\w+) - (\w+), (\d+)/,
        );
        if (!parts) break;
        const [_m, ms1, me1, yr1, ms2, me2, yr2] = parts;
        const dateCols = {
          p1: { year: yr1, monthStart: ms1, monthEnd: me1 },
          p2: { year: yr2, monthStart: ms2, monthEnd: me2 },
        };
        yield { dateCols };
        state = 'detail';
        break;
      }
      case 'detail': {
        if (
          (detail = line.match(
            /^\s*(TOTAL )?(?<type>ASSETS|LIABILITIES AND EQUITY)/,
          ))
        ) {
          acctType = detail.groups.type;
          if (!detail[1]) yield detail.groups;
        } else if (
          (detail = line.match(/\s*(?<basis>Accrual) Basis (?<dateTime>.*)/))
        ) {
          yield detail.groups;
          state = 'date-cols';
        } else if (
          (detail = line.match(
            /^\s*(?<acct>(?<code>\d+)?\s*(?<name>(?: \S|\S)+))\s*$/,
          ))
        ) {
          acctPath.push(detail.groups);
          yield { acctType, acctPath };
        } else if ((detail = line.match(/Total (?<acct>(?: \S|\S)+)/))) {
          const [{ acct: old }] = acctPath.slice(-1);
          if (old === detail.groups.acct) {
            acctPath.pop();
          }
          yield { acctPath };
        } else if (
          (detail = line.match(
            /^\s*(?<name>(?: \S|\S)+) {2}\s+(?<amt1>\S+)? \s+(?<amt2>\S+)\s*$/,
          ))
        ) {
          yield detail.groups;
        } else {
          console.error({ line });
          throw Error(`not impl`);
        }
        break;
      }
      default:
        throw Error(`not implemented: ${state}`);
    }
  }
}

const main = async ({ stdin }) => {
  const txt = await read(stdin);
  const lines = txt.split('\n');

  for (const item of reportItems(lines)) {
    console.log(item);
  }
};

/* global require, module, process */
if (require.main === module) {
  main({ stdin: process.stdin }).catch(console.error);
}
