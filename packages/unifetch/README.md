# unifetch - fetch account info from UniSwap / GraphQL API

Stretch goal: Compute capital gains for UniSwap trades.

1.  fetch UniSwap transaction history
    - to browser localStorage?
2.  save raw data to GnuCash mysql DB
    - using JSON type?
3.  Sync trades <-> transactions
    - Sync fees with expense accounts
    - Sync tokens <-> commodities
4.  Assign lots
5.  Calculate gains / losses

## Platform: Browser?

## References

- [Uniswap Info](https://info.uniswap.org/accounts)
- [Uniswap V2 Subgraph](https://thegraph.com/explorer/subgraph/uniswap/uniswap-v2) query explorer
  - [Explorer \- GitHub Docs](https://docs.github.com/en/free-pro-team@latest/graphql/overview/explorer) for pretty-printing
  - [Graph Docs](https://thegraph.com/docs/graphql-api#schema)
- [uniswap\-v2\-subgraph/schema\.graphql](https://github.com/Uniswap/uniswap-v2-subgraph/blob/master/schema.graphql) source code
- [Uniswap/uniswap\-info: ℹ️ Uniswap analytics\.](https://github.com/Uniswap/uniswap-info)
- [uniswap\-info/index\.js at 932efce769c353bde087d2dfd2a448bd5d19a3c2 · Uniswap/uniswap\-info](https://github.com/Uniswap/uniswap-info/blob/932efce769c353bde087d2dfd2a448bd5d19a3c2/src/components/PositionList/index.js#L141-L142)
- [SQL \- GnuCash](https://wiki.gnucash.org/wiki/SQL)
- [MySQL :: MySQL 5\.7 Reference Manual :: 11\.5 The JSON Data Type](https://dev.mysql.com/doc/refman/5.7/en/json.html)
