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

    $ alias node=node --harmony-proxies
    $ discover=@`node server -make ofxies.makeOFX discover protocol=OFX object=disc1 | tail -1`

### Fetch OFX data

Test OFX access from the command line:

    $ node server -post $discover fetch

After a few seconds, your transactions going back 60 days should
appear in node console log.

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

  - Get details on Discover transactions: which card? address?
  - account auto-complete with bacon FRP
  - subscribe to account balance changes using
    mysql-events and websockets
