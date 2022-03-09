finquick -- family finance tools of a closet librarian
======================================================

My ideal personal accounting system would

 - support double-entry accounting, with budgeting, reports, and charts
 - have an open architecture with
   - an SQL back-end
   - a flat-file serialization of the data suitable for use with version control
 - integrate with the Web, both
   - allowing access from any machine with a web browser
   - syncing with banking web sites

| System    | Start | Stop  | Double-Entry | Open | SQL | Web UI | Bank/Card Sync |
----------  | ----- | ----- | ------------ | ---- | --- | --- | ---- |
LunchMoney  | 2021- | | **NO** | Web API | NO | yes | yes
GnuCash     | 2010-06 | | yes | yes | yes | **NO** | some |
Mint        | 2011? | 2012-02 | **NO** | NO* | NO | yes | yes
Quicken     | 1990 | 2010-06 | yes | **NO** | no | no | some
EXP BASIC09 | 1986-09 | 1987-03 | yes | yes | no | no | no

### Journal: blog items, commits

 - 2022-01: [ingest balance sheet report · PR \#19](https://github.com/dckc/finquick/pull/19)
   - [ingest 2021 Q2 balance sheet into RVote agenda · PR \#63](https://github.com/rchain/reference/pull/63)
 - 2021-09: sync with LunchMoney: 86cda00 thru 49e7a75
   - LunchMoney is delightful in a lot of ways, but it's not good enough to replace GnuCash yet. And while syncing between the two seems feasible in theory, I have yet to manage in practice.
 - 2021-10: 6c95342: feat: fetch anchor protocol history
 - 2021-09: 03f4c9d * feat: coinbase card to CSV for lunch money
 - 2021-04: 2f551fe * feat: fetch cosmos account history
 - 2021-03: f8e7a0b * feat(coinbase): fetch accounts and transactions
 - 2021-02: 3c70ba7 * feat(etherscan): download ERC20 transactions to DB
 - 2021-02: 80633bd * style(brcal): agoric js style
 - 2020-11: 120f493 * brcal - budget review calendar sync
 - 2021-01: fbf5194 * unifetch: fetch position, transaction data using uniswap graphql
 - 2020-11: a0642ca * brscript: sync budget review calendar using Google Apps Script
 - 2017-12: [College Expense Tracking in BASIC09](https://www.madmode.com/2017/ut-austin-expenses.html)
 - 2016-2018: Capper Web UI for GnuCash DB
   - 2017-09 40cc1d2 * expose desktop presense, secret service as capper app
   - 2016-12 08f3c7a * simple: offline conversion from JSON to OFX
   - 2016-02: 5dc7ec4 * account balances react to database transactions
   - 2016-01-30 62bb854 * bootstrap style for budget UI
   - 2016-01-17 394abdc * login with username, challenge question, and password page (WebDriver / Nightmare)
   - 2016-01: 5fcde6f * use node.js `require.main` idiom (a la python's `__main__`)
   - 2016-01: 1196a44 * budget.js: flow type annotations
 - 2012-05: 2678623 * OFX to ElementTree works in 1 case
 - 2012-04: a1b1e41 * toward web app access to gnucash db: pyramid alchemy scaffold
   - GnuCash 2.4.10 supports SQL 
 - 2009-05: [Expense reporting with Android, GnuCash, and IRS\.gov](https://www.madmode.com/2009/05/expense-reporting-with-android-gnucash.html)
 - 2006-03: [Getting my Personal Finance data back with hCalendar and hCard](https://www.madmode.com/2006/breadcrumbs_0096.html)
   - trxht -- format personal finance transactions as hCalendar

## 2018: Capper Web UI for GnuCash DB

Features to date:

  - Current account balances from [GnuCash][] mysql DB
    - real-time updates in response to edits in GnuCash
  - OFX Sync between financial services and GnuCash
    - Fetch credit card transactions using the OFX protocol
    - Fetch transactions by scripted browsing from paypal and some banks
      - Convert to OFX format
    - Preview import
    - Cache fetched data
      - with a slider for max-age
  - Search transactions by amount

Security techniques:

  - No passwords in the web interface. Instead, we use [webkeys][],
    i.e. unguessable, self-authorizing urls. The short video
    [Webkeys versus Passwords][wvp] argues that this is at least as
    secure as using passwords.
  - Passwords for access to financial services and GnuCash database
    are managed with the same [freedesktop secret store][fss] used
    by GnuCash, Google chrome, etc.

[GnuCash]: http://gnucash.org/
[fss]: https://specifications.freedesktop.org/secret-service/
[webkeys]: http://waterken.sourceforge.net/web-key/
[wvp]: https://www.youtube.com/watch?v=C7Pt9PGs4C4
[Capper]: https://github.com/marcsAtSkyhunter/Capper


## Configure GnuCash DB budget access

We use [Capper][] command-line conventions for creating webkeys. One
kind of webkey authorizes looking up the GnuCash database password in
the secret store (e.g. Gnome Keyring) and using for browsing and
syncing. _TODO: support Apple keychain, Windows equivalent._

The secret store attributes GnuCash uses are `protocol`, `server`,
`user`, and `object`. We'll also supply database connection options
with `host`, `user`, and `database` properties. The `server`,
`protocol`, and `object` attributes have sensible defaults:

    $ budget=@`node server -make ofxies.makeBudget database=db1 user=me | tail -1`

Now we can check the balance of an account since some date:

    $ node server -post $budget acctBalance Cash 2015-10-01
    ...
    {"=":{"balance":473.04,"name":"Cash","since":"2015-10-01 00:00:00.000"}}

This `$budget` is a webkey:

    $ echo $budget
    @https://localhost:1341/ocaps/#s=Yslejls...

If you start the service (with `npm start`) and visit that address in
your web browser, you should get a page showing the balances of your
current accounts, _where current is defined as account code between
'1000' and '2199' excluding '1500' to '1999. TODO: flexible definition
of current accounts.'_


## Sync with Paypal

Another kind of webkey authorizes downloading transaction data from
paypal using scripted browsing, provided you have signed in to paypal
with a browser such as Google Chrome and allowed the browser to save
your password.

The budget web UI has a Settings tab where you can set this up. But
this is what's going underneath:

To create a PayPal webkey, give your paypal login.

    $ paypal=@`node server -make ofxies.makePayPal login123 | tail -1`

To test it out:

    $ node server -post $paypal fetch

After a minute or so of scripted browsing, your should appear in node
console log.

Then connect it to your GnuCash paypal account by account number:

    $ node server -post $budget setRemote 1234 $paypal

If you `npm start` the server again, when you visit the `$budget`
page, if you choose your PayPal account from the list and hit
**Preview**, you should get a list of PayPal transactions that have
not yet been imported into GnuCash. If you hit **Sync**, the pending
transactions should get imported _unless the GnuCash DB is in use, in
which case you'll get an error dialog._


## Sync with credit card OFX services

To create a webkey to download credit card transaction data via OFX,
first put your access credentials in the freedesktop secret store. The
credit card number, username, and password are combined into one
secret, separated by spaces; `protocol` and `object` attributes are
used for lookup:

    $ echo 601.... con... sekret | secret-tool store --label='My Discover' protocol OFX object disc1

Then use the Settings tab in the budget web UI. Again, what happens
underneath is we make the OFX webkey:

    $ discover=@`node server -make ofxies.makeOFX discover protocol=OFX object=disc1 | tail -1`

We can test access from the command line:

    $ node server -post $discover fetch

_See `institutionInfo` in the source to add support for services beyond
`discover` and `amex`._


## Background / Motivation

I gather OFX data from ~5 sources and sync with gnucash (and then do
budgeting/categorization within gnucash).

 - for 2 of my OFX sources, I can grab the data by running python code
   with some credentials stored in ~/.foo
 - for 1, I use my browser to download the OFX and then move the file
   where I want it.
   - I have written selenium webdriver stuff to
     automate this part, but it's fragile.
 - for 2 others, I download CSV or JSON and convert to OFX
   - by "download" I mean: I log into a web site and then download.

Support for SQL storage in [GnuCash][] 2.4.10 allows reuse of the data
using Web technologies, without extensive study of the GnuCash source
code (which is upwards of 10MB, compressed).

[Capper][] is a web application framework that provides webkeys for
the node.js programmer.

> A web application server with built-in object capability security
> built on Node.js/Express ...  Persistence of remotely-accessible
> objects is automated ...  Capper uses the same webkey protocol that
> the Waterken Java-based platform uses ...

Finquick provides a nice web UI for syncing all my sources.

## TODO

  - account auto-complete with bacon FRP
    - on my wish-list for
      [a decade or so](http://dig.csail.mit.edu/breadcrumbs/node/96)
  - capture, verify new balance on transaction download
  - during headless browsing, send progress to UI via websocket
  - Get details on Discover transactions: which card? address?
  - figure out where to put jspm_packages and how to set up config.js

I'd like to have a long-running process that I can trust to fetch the
data periodically (daily, where a failed day here and there is
acceptable).
 
These web sites provide no attenuation; there's no credential for just
read-only access to the financial data. The only thing the site
supports is a username/password that gives full account access,
including the ability to send money.

I don't like relying on my desktop as a server, though perhaps I
prefer that to something cloud-hosted. Perhaps I'm most inclined to
trust my mobile phone, since I pretty much carry it everywhere. (its
TCB is too big, but seL4 shows that it doesn't have to be...). I have
TOTP/HOTP on my phone (google authenticator). That can be used to
"bootstrap" a capability that lasts a few days... maybe a couple weeks
or a month... or until I reboot the phone... I'd prefer to just use
the phone to "poke" a long-running service rather than doing all the
computation there.

A central tension is: there are tools and libraries for imitating a
web browser on traditional platforms, but not on ocap platforms.

**TODO**: confine headless browser to its own capper app?


    ~/projects/fincap$ npm install
    npm WARN engine zongji@0.3.2: wanted: {"node":"0.10"} (current: {"node":"5.5.0","npm":"3.3.12"})
    npm WARN deprecated bignumber.js@2.0.0: critical bug fixed in v2.0.4
    npm WARN deprecated graceful-fs@3.0.8: graceful-fs version 3 and before will fail on newer node releases. Please update to graceful-fs@^4.0.0 as soon as possible.


## Dev Notes

_See CONTRIBUTING._
