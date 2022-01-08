/* eslint-disable camelcase */
// @ts-check
/* global Buffer */

/* eslint-disable no-cond-assign */
/* eslint-disable no-continue */

const crypto = require('crypto');

const { entries, fromEntries, values } = Object;

/** @param { number } n */
const range = n => [...Array(n).keys()];
const monthByName = fromEntries(
  range(12).map(m => [
    new Date(2000, m, 1)
      .toDateString() // Assumes US locale? implementation-dependent?
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
 * @typedef {typeof example.heading} Heading
 * @typedef {typeof example.detail} Detail
 */
// eslint-disable-next-line no-unused-vars
const example = {
  heading: {
    org: 'RChain Cooperative',
    report: 'Balance Sheet',
    reportDate: '2021-06-30T05:00:00.000Z',
  },
  detail: {
    acctType: 'ASSETS',
    name: '1010 BECU Checking',
    amt: -104843.93,
    period: {
      start: [2021, 1],
      end: [2021, 3],
    },
    acctPath: ['Current Assets', 'Bank Accounts'],
  },
};

/**
 * @param {string[]} lines
 * @returns {Heading}
 */
function getHeading(lines) {
  const [org, report, asOf] = lines.slice(0, 3).map(l => l.trim());
  const reportDate = parseDate(asOf.replace('As of ', ''));
  return { org, report, reportDate: JSON.stringify(reportDate).slice(1, 11) };
}

/**
 * @param {string[]} lines
 * @yields {Detail}
 */
function* reportItems(lines) {
  let state = 'date-cols';
  let acctType;
  let periods;
  /** @type { string[] } */
  const acctPath = [];
  let detail;
  const n = txt => parseInt(txt, 10);
  for (const line of lines) {
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
          // console.error({ acctPath, ...groups });
          // TODO: account codes here too
          if (!acctType) throw TypeError();
          if (the(detail.groups).amt1)
            yield {
              acctType,
              name: groups.name,
              // TODO: rationals?
              amt: parseAmt(the(detail.groups).amt1),
              period: the(periods).p1,
              acctPath: [...acctPath],
            };
          yield {
            acctType,
            name: groups.name,
            amt: parseAmt(groups.amt2),
            period: the(periods).p2,
            acctPath: [...acctPath],
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

const md5 = txt =>
  crypto
    .createHash('md5')
    .update(txt)
    .digest('hex');

/**
 * @param { T[] } xs
 * @returns {Array<[T, T]>}
 * @template T
 */
const pairs = xs =>
  xs.slice(1).reduce(
    ({ acc, prev }, cur) => ({
      acc: [...acc, /** @type {[T, T]} */ ([prev, cur])],
      prev: cur,
    }),
    { acc: [], prev: xs[0] },
  ).acc;

/**
 * @param {[K, V][]} kvs
 * @template K
 * @template V
 * @returns {Record<K, V[]>}
 */
const collectByKey = kvs => {
  const keys = [...new Map(kvs).keys()];
  return fromEntries(
    keys.map(k => [k, kvs.filter(([x, _v]) => x === k).map(([_x, v]) => v)]),
  );
};

/** @param { Detail[] } details */
const getAccounts = details => {
  // de-duplicate
  const byName = fromEntries(
    details.map(({ acctType, name, acctPath }) => [
      name,
      { acctType, name, acctPath },
    ]),
  );
  const byType = collectByKey(
    values(byName).map(a => /** @type { [string, typeof a] } */ ([
      a.acctType,
      a,
    ])),
  );

  const accounts = entries(byType)
    .map(([acctType, accts]) => {
      const childOf = fromEntries(
        accts.map(({ name, acctPath }) => pairs([name, ...acctPath])).flat(),
      );
      const children = fromEntries(
        entries(childOf).map(([child, parent]) => [
          child,
          {
            acctType,
            name: child,
            parent,
          },
        ]),
      );
      const parents = fromEntries(
        entries(childOf).map(([_child, parent]) => [
          parent,
          {
            acctType,
            name: parent,
            parent: undefined,
          },
        ]),
      );

      return values({ ...parents, ...children });
    })
    .flat();

  return accounts.map(({ acctType, name, parent }) => {
    const m = name.match(/(?<acct>(?<code>\d+)?\s*(?<name>.*))/);
    if (!m) throw TypeError();
    const { code } = the(m.groups);
    return {
      guid: md5([name, parent].join('\t')),
      name,
      account_type: acctType === 'ASSETS' ? 'ASSET' : 'LIABILITY',
      code,
    };
  });
};

const trunc = ymd => ymd.slice(0, 'yyyy-mm'.length);

/**
 *
 * @param {Detail[]} details
 * @param {{ name: string, guid: string}[]} accounts
 * @param {string} description
 * @param {string} openingGuid
 */
const getInitialBalances = (details, accounts, description, openingGuid) => {
  const acctGuid = fromEntries(accounts.map(({ name, guid }) => [name, guid]));
  const transactions = details.map(
    ({
      period: {
        end: [y, m],
      },
      name,
      amt,
    }) => {
      const tx_guid = md5(JSON.stringify({ name, month: [y, m], amt }));
      const tx = {
        guid: tx_guid,
        post_date: new Date(y, m - 1, 15).toISOString().slice(0, 10),
        description,
        splits: [
          {
            guid: md5(`${tx_guid}+`),
            tx_guid,
            account_guid: acctGuid[name],
            value_num: amt * 100,
            value_denom: 100,
          },
          {
            guid: md5(`${tx_guid}-`),
            tx_guid,
            account_guid: openingGuid,
            value_num: -amt * 100,
            value_denom: 100,
          },
        ],
      };
      return tx;
    },
  );
  return {
    splits: transactions.map(({ splits }) => splits).flat(),
    transactions: transactions.map(({ splits: _, ...tx }) => tx),
  };
};

// gnucash picked this in one case
const openingBalances = 'a509231ddc6043df93e7f6e231fb46e0';

const main = async ({ stdin, stdout }) => {
  const txt = await read(stdin);
  const lines = txt.split('\n');

  const heading = getHeading(lines);
  const details = [...reportItems(lines.slice(3))];
  const accounts = getAccounts(details);

  const current = details.filter(
    ({ period: { end } }) =>
      trunc(new Date(end[0], end[1] - 1, 1).toISOString()) ===
      trunc(heading.reportDate),
  );

  const { transactions, splits } = getInitialBalances(
    current,
    accounts,
    `${heading.report} ${trunc(heading.reportDate)}`,
    openingBalances,
  );
  const tables = { accounts, transactions, splits };
  const data = { heading, details, tables };
  stdout.write(JSON.stringify(data, null, 2));
  stdout.write('\n');
};

/* global require, module, process */
if (require.main === module) {
  main({ stdin: process.stdin, stdout: process.stdout }).catch(console.error);
}
