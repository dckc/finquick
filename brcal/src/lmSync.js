// @ts-check

import { WebApp } from './WebApp';

const LunchMoneyAPI = {
  endpoint: 'https://dev.lunchmoney.app',
};

/**
 * lmSync - sync client for Lunch Money API
 *
 * @param { string[] } args
 * @param { typeof process.env } env
 * @param {{
 *   https: typeof import('https'),
 * }} io
 */
export const lmSync = async (args, env, { https }) => {
  const { LUNCH_MONEY_API_KEY: apiKey } = env;
  const creds = { Authorization: `Bearer ${apiKey}` };
  console.log(creds);
  const api = WebApp(LunchMoneyAPI.endpoint, { https }, creds);
  const categories = await api.pathjoin('/v1/categories').get();
  console.log(categories);
};

/* global require, module, process */
if (require.main === module) {
  lmSync(
    process.argv.slice(2),
    { ...process.env },
    {
      // eslint-disable-next-line global-require
      https: require('https'),
    },
  ).catch(err => console.error(err));
}
