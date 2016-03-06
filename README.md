# finquick on Capper

 - [Capper][] v 0.1, webkeys for the node.js programmer.

[Capper]: https://github.com/marcsAtSkyhunter/Capper

> A web application server with built-in object capability security
> built on Node.js/Express ...  Persistence of remotely-accessible
> objects is automated ...  Capper uses the same webkey protocol that
> the Waterken Java-based platform uses ...

## Fetch 60 days of transactions

### Put your OFX account credentials in the freedesktop secret store

The credit card number, username, and password are combined into one
secret, separated by spaces; `protocol` and `object` attributes are
used for lookup:

    $ echo 601.... con... sekret | secret-tool store --label='My Discover' protocol OFX object disc1

### Create an OFX account capper object

For `discover` or `amex`:

    $ alias node="node --harmony-proxies"
    $ discover=@`node server -make ofxies.makeOFX discover protocol=OFX object=disc1 | tail -1`

### Fetch OFX data

Test OFX access from the command line:

    $ node server -post $discover fetch

After a few seconds, your transactions going back 60 days should
appear in node console log.

### Create a capability to fetch OFX from BankBV

We look up the login password using the `signon_realm` attribute,
following Chrome conventions.

For challenge questions, we use 'code' and 'question' as in:

    $ ssh-askpass | secret-tool store --label 'Challenge Question' \\
        url https://www.bankbv.com/ code 1234 \\
        question "What is your mother's maiden name?"

    $ bankbv=@`node server -make ofxies.makeBankBV login123 1234 | tail -1`

**TODO**: confine headless browser to its own capper app?


## GnuCash DB budget access

Following GnuCash, we access the database password by `protocol`,
`server`, `user`, and `object` attributes. The database connection
options are given with `host`, `user`, and `database` properties. The
`server`, `protocol`, and `object` attributes have sensible defaults:

    $ budget=@`node server -make ofxies.makeBudget database=db1 user=me | tail -1`

Now we can check the balance of an account since some date:

    $ node server -post $budget acctBalance Cash 2015-10-01
    ...
    {"=":{"balance":473.04,"name":"Cash","since":"2015-10-01 00:00:00.000"}}

The resulting `$discover` is a webkey:

    $ echo $discover
    @https://localhost:1341/ocaps/#s=Yslejls...

If you visit that address in your web browser and fill in an account
name and a date, the **Get Ledger** button should show transactions
since that date.

## Introducing the budget to the OFX remote accounts

Make sure to give your remote accounts codes in GnuCash; say `1234`:

    $ node server -post $budget setRemote 1234 $discover

Now the **Fetch OFX** button on the web page should work, once you
fill in 1234 in the **Balance account code** field.

**TODO**: highlight OFX transactions that are not yet in GnuCash and
  allow the user to import them.

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

These web sites provide no attenuation; there's no credential for juts
read-only access to the financial data. The only thing the site
supports is a username/password that gives full account access,
including the ability to send money.

I have also written code to synx OFX data with the SQL store I use for
gnucash in a "headless" fashion, but I don't use it because gnucash
doesn't support multi-user access. I could quit gnucash, but I usually
leave it running.

I'd like to have a long-running process that I can trust to fetch the
data periodically (daily, where a failed day here and there is
acceptable).
 
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


## TODO

  - match imported transactions across accounts
  - during headless browsing, send progress to UI via websocket
  - Get details on Discover transactions: which card? address?
  - account auto-complete with bacon FRP
  - figure out where to put jspm_packages and how to set up config.js


```
~/projects/fincap$ npm install
npm WARN engine zongji@0.3.2: wanted: {"node":"0.10"} (current: {"node":"5.5.0","npm":"3.3.12"})
npm WARN deprecated bignumber.js@2.0.0: critical bug fixed in v2.0.4
npm WARN deprecated graceful-fs@3.0.8: graceful-fs version 3 and before will fail on newer node releases. Please update to graceful-fs@^4.0.0 as soon as possible.
```

## Dev Notes

 - ES6, flow: const, modules, arrow functions, template strings
   - eslint for server side
     - no destructuring let/const yet. hm.
   - jspm for UI side
 - Q promises
 - ocap style: all authority passed in explicitly
 - docopt for arg parsing dervied from usage doc
 - gnucash db using mysql
   - follow locking protocol
 - freedesktop secret store (gnome keyring)
 - npm banking for OFX from credit cards
   - use capper persistent state for caching
 - nightmare for headless browsing
   - generator functions, yield, Q.async()
 - [CSS Bootstrap][bs] and [Bacon.js][frp] for UI
   - table style
   - error dialogs, busy indicators
   - Functional Reactive Programming
 - android access: self-signed cert, CA
 - account balance UI reacts to DB changes using websockets, mysql-events
 
 
[bs]: http://getbootstrap.com/css/
[frp]: https://baconjs.github.io/
