// @ts-check

const { freeze } = Object;
const { log } = console;
const q = JSON.stringify;

/**
 * @param { EndPoint } endPoint
 * @typedef { ReturnType<typeof import('./WebApp').WebApp> } EndPoint
 */
export function GraphQL(endPoint) {
  return freeze({
    /** @type {(query: string, variables: Record<string, unknown>) => Promise<unknown>} */
    async runQuery(query, variables) {
      log({ endPoint, variables, query: query.split('\n')[0] });
      const result = await endPoint.post(q({ variables, query }));
      return JSON.parse(result);
    },
  });
}
