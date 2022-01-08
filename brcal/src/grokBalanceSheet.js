// @ts-check
/* eslint-disable no-cond-assign */
/* eslint-disable no-continue */
/* global Buffer */
const { fromEntries } = Object;
/** @param { number } n */
const range = n => [...Array(n).keys()];
const monthByName = fromEntries(
  range(12).map(m => [
    new Date(2000, m, 1)
      .toDateString()
      .slice(4, 7)
      .toUpperCase(),
    m,
  ]),
);

/** @param { string } txt */
const parseDate = txt => {
  const parts = txt.match(/(\w+) (\d+), (\d+)/);
  if (!parts) throw RangeError(txt);
  const [_all, monthName, day, yr] = parts;
  const month = monthByName[monthName.slice(0, 3).toUpperCase()];
  return new Date(parseInt(yr, 10), month, parseInt(day, 10));
};

/** @param { string } txt */
const parseAmt = txt => parseFloat(txt.replace(',', ''));

/**
 * @param {T | undefined} x
 * @returns T
 * @template T
 */
const the = x => {
  if (!x) throw TypeError();
  return x;
};
async function read(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * @param {string[]} lines
 * @yields {Record<string, unknown>}
 */
function* reportItems(lines) {
  const [org, report, asOf] = lines.slice(0, 3).map(l => l.trim());
  const reportDate = parseDate(asOf.replace('As of ', ''));
  yield { org, report, reportDate };

  let state = 'date-cols';
  let acctType;
  let periods;
  /** @type { string[] } */
  const acctPath = [];
  let detail;
  const n = txt => parseInt(txt, 10);
  for (const line of lines.slice(3)) {
    if (line.trim() === '') continue;
    switch (state) {
      case 'date-cols': {
        const parts = line.match(
          /\s+(\w+) - (\w+), (\d+)\s+(\w+) - (\w+), (\d+)/,
        );
        if (!parts) break;
        const [_m, ms1, me1, yr1, ms2, me2, yr2] = parts;
        // TODO: end of month = start of next month - 1?
        periods = {
          p1: {
            start: [n(yr1), monthByName[ms1] + 1],
            end: [n(yr1), monthByName[me1] + 1],
          },
          p2: {
            start: [n(yr2), monthByName[ms2] + 1],
            end: [n(yr2), monthByName[me2] + 1],
          },
        };
        state = 'detail';
        break;
      }
      case 'detail': {
        if (
          (detail = line.match(
            /^\s*(TOTAL )?(?<type>ASSETS|LIABILITIES AND EQUITY)/,
          ))
        ) {
          acctType = the(detail.groups).type;
        } else if (
          (detail = line.match(/\s*(?<basis>Accrual) Basis (?<dateTime>.*)/))
        ) {
          // TODO? yield detail.groups;
          state = 'date-cols';
        } else if (
          (detail = line.match(
            /^\s*(?<acct>(?<code>\d+)?\s*(?<name>(?: \S|\S)+))\s*$/,
          ))
        ) {
          acctPath.push(the(detail.groups).acct);
        } else if ((detail = line.match(/Total (?<acct>(?: \S|\S)+)/))) {
          const [old] = acctPath.slice(-1);
          if (old === the(detail.groups).acct) {
            acctPath.pop();
          }
        } else if (
          (detail = line.match(
            /^\s*(?<name>(?: \S|\S)+) {2}\s+(?<amt1>\S+)? \s+(?<amt2>\S+)\s*$/,
          ))
        ) {
          const groups = the(detail.groups);
          // TODO: account codes here too
          if (the(detail.groups).amt1)
            yield {
              acctType,
              name: groups.name,
              // TODO: rationals?
              amt: parseAmt(the(detail.groups).amt1),
              period: the(periods).p1,
              acctPath,
            };
          yield {
            acctType,
            name: groups.name,
            amt: parseAmt(groups.amt2),
            period: the(periods).p2,
            acctPath,
          };
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

const main = async ({ stdin, stdout }) => {
  const txt = await read(stdin);
  const lines = txt.split('\n');

  const items = reportItems(lines);
  const { value: heading } = items.next();
  const detail = [...items];
  stdout.write(JSON.stringify({ heading, detail }, null, 2));
  stdout.write('\n');
};

/* global require, module, process */
if (require.main === module) {
  main({ stdin: process.stdin, stdout: process.stdout }).catch(console.error);
}
