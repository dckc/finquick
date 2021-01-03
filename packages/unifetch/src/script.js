// @ts-check

export const q1 = `
query($id:String!){
  user(id: $id) {
    id
  }
}`;

const { freeze } = Object;
const { log } = console;

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
      console.error({ methodUrl: addr, request, err });
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
