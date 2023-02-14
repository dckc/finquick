# finquick -- family finance tools of a closet librarian

My ideal personal accounting system would

- support double-entry accounting, with budgeting, reports, and charts
- have an open architecture with
  - an SQL back-end
  - a flat-file serialization of the data suitable for use with version control
- integrate with the Web, both
  - allowing access from any machine with a web browser
  - syncing with banking web sites

| System      | Start   | Stop    | Double-Entry | Open    | SQL | Web UI | Bank/Card Sync |
| ----------- | ------- | ------- | ------------ | ------- | --- | ------ | -------------- |
| LunchMoney  | 2021-   |         | **NO**       | Web API | NO  | yes    | yes            |
| GnuCash     | 2010-06 |         | yes          | yes     | yes | **NO** | some           |
| Mint        | 2011?   | 2012-02 | **NO**       | NO\*    | NO  | yes    | yes            |
| Quicken     | 1990    | 2010-06 | yes          | **NO**  | no  | no     | some           |
| EXP BASIC09 | 1986-09 | 1987-03 | yes          | yes     | no  | no     | no             |

### Journal: blog items, commits

- 2022-01: [ingest balance sheet report · PR \#19](https://github.com/dckc/finquick/pull/19)
  - [ingest 2021 Q2 balance sheet into RVote agenda · PR \#63](https://github.com/rchain/reference/pull/63)
- 2021-09: sync with LunchMoney: 86cda00 thru 49e7a75
  - LunchMoney is delightful in a lot of ways, but it's not good enough to replace GnuCash yet. And while syncing between the two seems feasible in theory, I have yet to manage in practice.
- 2021-10: 6c95342: feat: fetch anchor protocol history
- 2021-09: 03f4c9d \* feat: coinbase card to CSV for lunch money
- 2021-04: 2f551fe \* feat: fetch cosmos account history
- 2021-03: f8e7a0b \* feat(coinbase): fetch accounts and transactions
- 2021-02: 3c70ba7 \* feat(etherscan): download ERC20 transactions to DB
- 2021-02: 80633bd \* style(brcal): agoric js style
- 2020-11: 120f493 \* brcal - budget review calendar sync
- 2021-01: fbf5194 \* unifetch: fetch position, transaction data using uniswap graphql
- 2020-11: a0642ca \* brscript: sync budget review calendar using Google Apps Script
- 2017-12: [College Expense Tracking in BASIC09](https://www.madmode.com/2017/ut-austin-expenses.html)
- 2016-2018: Capper Web UI for GnuCash DB
  - 2017-09 40cc1d2 \* expose desktop presense, secret service as capper app
  - 2016-12 08f3c7a \* simple: offline conversion from JSON to OFX
  - 2016-02: 5dc7ec4 \* account balances react to database transactions
  - 2016-01-30 62bb854 \* bootstrap style for budget UI
  - 2016-01-17 394abdc \* login with username, challenge question, and password page (WebDriver / Nightmare)
  - 2016-01: 5fcde6f \* use node.js `require.main` idiom (a la python's `__main__`)
  - 2016-01: 1196a44 \* budget.js: flow type annotations
- 2012-05: 2678623 \* OFX to ElementTree works in 1 case
- 2012-04: a1b1e41 \* toward web app access to gnucash db: pyramid alchemy scaffold
  - GnuCash 2.4.10 supports SQL
- 2009-05: [Expense reporting with Android, GnuCash, and IRS\.gov](https://www.madmode.com/2009/05/expense-reporting-with-android-gnucash.html)
- 2006-03: [Getting my Personal Finance data back with hCalendar and hCard](https://www.madmode.com/2006/breadcrumbs_0096.html)
  - trxht -- format personal finance transactions as hCalendar
