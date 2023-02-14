# brcal - budget review calendar

Since GnuCash lacks a multi-user web interface, we synchronize
uncategorized GnuCash transactions with a Google calendar.  Accepting
an invitation means "yes, put that transaction in my part of the
budget."

## Usage

Once installed (see below)

1. quit GnuCash
2. `npm run sync`; output shows
  - count of transactions fetched from db, calendar
  - results of synchronization
  - calendar updates:
    - deleted transactions
    - patched (updated) transactions
    - posted (added) transactions
  - database updates
3. start GnuCash again

## Installation

```
npm install
```

_TODO: describe Google calendar script deplyment._

## Design, Development

See _CONTRIBUTING.md_ .
