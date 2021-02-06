// @ts-check

const { freeze } = Object;
const { log } = console;

/**
 * @param { string } endPoint
 * @param {{ fetch: typeof fetch }} io
 */
export function GraphQL(endPoint, { fetch }) {
  /** @type {(addr: string, request: Object) => Promise<Object> } */
  async function fetchJSON(addr, request) {
    // log({ addr, ...(request === undefined ? {} : { request }) });
    const opts = {
      method: 'POST',
      body: JSON.stringify(request),
      headers: { 'content-type': 'application/json' },
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
      log({ endPoint, variables, query: query.split('\n')[0] });
      return fetchJSON(endPoint, { variables, query });
    },
  });
}
