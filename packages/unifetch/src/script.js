// @ts-check

export const UniswapAPI = {
  endPoint: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2",
  qPositions: `
query($id:String!){
  user(id: $id) {
    liquidityPositions {
      liquidityTokenBalance
      pair {
        totalSupply
        reserveUSD
        token0 {
          id
          symbol
          name
          decimals
        }
        token1 {
          id
          symbol
          name
          decimals
        }
      }
    }
  }
}`,
  qTransactions: `
  query transactions($user: Bytes!) {
    mints(orderBy: timestamp, orderDirection: desc, where: { to: $user }) {
      id
      transaction {
        id
        timestamp
        __typename
      }
      pair {
        id
        token0 {
          id
          symbol
          __typename
        }
        token1 {
          id
          symbol
          __typename
        }
        __typename
      }
      to
      liquidity
      amount0
      amount1
      amountUSD
      __typename
    }
    burns(orderBy: timestamp, orderDirection: desc, where: { sender: $user }) {
      id
      transaction {
        id
        timestamp
        __typename
      }
      pair {
        id
        token0 {
          symbol
          __typename
        }
        token1 {
          symbol
          __typename
        }
        __typename
      }
      sender
      to
      liquidity
      amount0
      amount1
      amountUSD
      __typename
    }
    swaps(orderBy: timestamp, orderDirection: desc, where: { to: $user }) {
      id
      transaction {
        id
        timestamp
        __typename
      }
      pair {
        token0 {
          symbol
          __typename
        }
        token1 {
          symbol
          __typename
        }
        __typename
      }
      amount0In
      amount0Out
      amount1In
      amount1Out
      amountUSD
      to
      __typename
    }
  }
`,
};

const { freeze } = Object;
const { log } = console;

/**
 * @param {{
 *   $: typeof document.querySelector,
 *   fetch: typeof fetch,
 * }} io
 */
export function ui({ $, fetch }) {
  const gql = GraphQL(UniswapAPI.endPoint, { fetch });
  const fmt = (obj) => JSON.stringify(obj, null, 2);
  const amt = (txt) => parseFloat(txt);
  $("#run").addEventListener("click", (_click) => {
    const ethAddr = $("#ethAddr").value;

    gql.runQuery(UniswapAPI.qPositions, { id: ethAddr }).then((result) => {
      $("#result").value = fmt(result);
      const positions = result.data.user.liquidityPositions.map((position) => {
        const poolOwnership =
          amt(position.liquidityTokenBalance) / amt(position.pair.totalSupply);
        const valueUSD = poolOwnership * amt(position.pair.reserveUSD);
        console.log({
          name: `${position.pair.token0.symbol}-${position.pair.token1.symbol}`,
          valueUSD,
        });
      });
    });

    gql.runQuery(UniswapAPI.qTransactions, { user: ethAddr }).then((result) => {
      console.log(result);
    });
  });
}

/**
 * @param { string } endPoint
 * @param {{ fetch: typeof fetch }} io
 */
export function GraphQL(endPoint, { fetch }) {
  /** @type {(addr: string, request: ?Object) => Promise<Object> } */
  async function fetchJSON(addr, request = undefined) {
    log({ addr, ...(request === undefined ? {} : { request }) });
    const opts =
      request === undefined
        ? { method: "GET" }
        : {
            method: "POST",
            body:
              typeof request === "string" ? request : JSON.stringify(request),
          };
    const resp = await fetch(addr, opts);
    let result;
    try {
      result = await resp.json();
    } catch (err) {
      console.error({ addr, request, err });
      throw err;
    }
    // Add status if server error
    if (!resp.ok) {
      const ex = new Error(result);
      // @ts-ignore
      ex.status = resp.status;
      throw ex;
    }
    return result;
  }

  return freeze({
    /** @type {(query: string, variables: Record<string, unknown>) => Promise<unknown>} */
    async runQuery(query, variables) {
      return fetchJSON(endPoint, { query, variables });
    },
  });
}
