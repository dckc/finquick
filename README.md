finquick -- web app access to gnucash financial data
====================================================

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

    $ alias node="node --harmony-proxies"
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
your password. To create a PayPal webkey, give your paypal login.

    $ paypal=@`node server -make ofxies.makePayPal login123 | tail -1`

To test it out:

    $ node server -post $paypal fetch

After a minute or so of scripted browsing, your should appear in node
console log.

Then connect it to your GnuCash paypal account by account number:

    $ node server -post $budget setRemote 1234 $discover

If you `npm start` the server again, when you visit the `$budget`
page, if you choose your PayPal account from the list and hit
**Preview**, you should get a list of PayPal transactions that have
not yet been imported into GnuCash. If you hit **Sync**, the pending
transactions should get imported _unless the GnuCash DB is in use, in
which case you'll get an error dialog._

### Other scripted sites

A couple other financial services, including **simple.com**, work
similarly; see the source code for details.

For challenge questions, we use 'code' and 'question' as in:

    $ ssh-askpass | secret-tool store --label 'Challenge Question' \\
        url https://www.bankbv.com/ code 1234 \\
        question "What is your mother's maiden name?"

    $ bankbv=@`node server -make ofxies.makeBankBV login123 1234 | tail -1`


## Sync with credit card OFX services

To create a webkey to download credit card transaction data via OFX,
first put your access credentials in the freedesktop secret store. The
credit card number, username, and password are combined into one
secret, separated by spaces; `protocol` and `object` attributes are
used for lookup:

    $ echo 601.... con... sekret | secret-tool store --label='My Discover' protocol OFX object disc1

Then make the OFX webkey:

    $ discover=@`node server -make ofxies.makeOFX discover protocol=OFX object=disc1 | tail -1`

Again, we can test access from the command line:

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
 - [nightmare][] for headless browsing
   - generator functions, yield, Q.async()
 - [CSS Bootstrap][bs] and [Bacon.js][frp] for UI
   - table style
   - error dialogs, busy indicators
   - Functional Reactive Programming
 - android access: self-signed cert, CA
 - account balance UI reacts to DB changes using websockets, mysql-events
 
 
[bs]: http://getbootstrap.com/css/
[frp]: https://baconjs.github.io/
[nightmare]: http://www.nightmarejs.org/
