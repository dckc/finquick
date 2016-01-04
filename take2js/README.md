# finquick on Capper

 - [Capper][] v 0.1, webkeys for the node.js programmer.

[Capper]: https://github.com/marcsAtSkyhunter/Capper

> A web application server with built-in object capability security
> built on Node.js/Express ...  Persistence of remotely-accessible
> objects is automated ...  Capper uses the same webkey protocol that
> the Waterken Java-based platform uses ...

## Fetch 60 days of transactions

### Create an OFX institution object

For `discover` or `amex`:

    finquick/take2js/Capper$ discover=@`node --harmony server -make ofxies.makeInstitution discover | tail -1`

The resulting `$discover` should be a webkey a la
`@https://localhost:1341/ocaps/#s=Yslejls...`.

### Put your OFX account credentials in the freedesktop secret store

The credit card number, username, and password are combined into one
secret, separated by spaces; `protocol` and `object` attributes are
used for lookup:

    finquick/take2js/Capper$ echo 601.... con... sekret | secret-tool store --label='My Discover' protocol OFX object disc1

Then make a webkey for the freedesktop secret store:

    finquick/take2js/Capper$ store=@`node --harmony server -make ofxies.makeKeyStore | tail -1`

And make another for access to just the relevant entry:

    finquick/take2js/Capper$ key=@`node --harmony server -make ofxies.makePassKey $store protocol OFX object 8146 | tail -1`


### Create an account object

Now we're ready to make a webkey for the account:

    finquick/take2js/Capper$ disc1=@`node --harmony server -make ofxies.makeAccount $discover $key | tail -1`
    finquick/take2js/Capper$ echo $disc1
	@https://localhost:1341/ocaps/#s=abc123...

### Fetch

Access the webkey from above and hit **Fetch**; after a few seconds, a
table your transactions going back 60 days should appear.

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
