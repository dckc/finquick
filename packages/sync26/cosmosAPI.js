/**
 * https://github.com/cosmos/cosmos-sdk/blob/main/client/docs/swagger-ui/swagger.yaml
 */
const makeLCD = (fetch, endpoint) => {
  const { freeze } = Object;

  const getJSON = path => fetch(endpoint + path).then(res => res.json());

  return freeze({
    account: addr =>
      freeze({
        balances: () => getJSON(`/cosmos/bank/v1beta1/balances/${addr}`),
        delegations: () =>
          getJSON(`/cosmos/staking/v1beta1/delegations/${addr}`),
        unbonding: () =>
          getJSON(
            `/cosmos/staking/v1beta1/delegators/${addr}/unbonding_delegations`,
          ),
        rewards: () =>
          getJSON(`/cosmos/distribution/v1beta1/delegators/${addr}/rewards`),
      }),
    denom: denom =>
      freeze({
        meta: () => getJSON(`/cosmos/bank/v1beta1/denoms_metadata/${denom}`),
      }),
  });
};

const testLCD = async (
  addr = 'agoric1ut8wc2l52layqq8lmxfvd9vwhdge2x5qsqrhrl',
  endpoint = 'https://api.agoric.nodestake.top',
) => {
  const fetch = makeFetch();
  const lcd = makeLCD(fetch, endpoint);

  // odd: denom ubld: key not found
  // const bldInfo = await lcd.denom('ubld').meta();
  // console.log(bldInfo);
  const acct = lcd.account(addr);
  const rewards = await acct.rewards();
  console.log(rewards);
};

const sum = xs => xs.reduce((acc, cur) => acc + cur, 0);

async function AccountInfo(addr, hd = true, denom = 'ubld', _nonce, io = {}) {
  const {
    doc = SpreadsheetApp.getActive(),
    endpoint = doc.getRangeByName('AgoricLCD').getValue(),
    fetch = makeFetch(),
    lcd = makeLCD(fetch, endpoint),
    acct = lcd.account(addr),
  } = io;
  const { balances } = await acct.balances();
  if (balances.length > 1) throw Error('unsupported');
  if (balances.length > 0 && balances[0].denom !== denom)
    throw Error('unsupported');
  const balance = balances.length === 0 ? 0 : Number(balances[0].amount);
  const { delegation_responses } = await acct.delegations();
  const delegation = sum(
    delegation_responses.map(({ balance }) => Number(balance.amount)),
  );
  const rewards = await acct.rewards();
  if (rewards.total.length > 1) throw Error('unsupported');
  const reward =
    rewards.total.length === 1 ? Number(rewards.total[0].amount) : 0;
  const { unbonding_responses } = await acct.unbonding();
  const unbonding = sum(
    unbonding_responses.flatMap(r => r.entries.map(e => Number(e.balance))),
  );
  const record = { balance, delegation, reward, unbonding };
  const values = Object.values(record).map(micro => micro / 1000000);
  if (!hd) return [values];
  return [Object.keys(record), values];
}

async function testAccountInfo(io = {}) {
  const {
    doc = SpreadsheetApp.getActive(),
    addr = doc.getRangeByName('testAddr').getValue(),
  } = io;
  const rows = await AccountInfo(addr, true, 'ubld', 1, { doc });
  console.log(rows);
}

async function PendingReward(addr) {
  console.warn('AMBIENT: SpreadsheetApp');
  const doc = SpreadsheetApp.getActive();
  const endpoint = doc.getRangeByName('AgoricLCD').getValue();

  const fetch = makeFetch();
  const lcd = makeLCD(fetch, endpoint);
  const acct = lcd.account(addr);
  const rewards = await acct.rewards();
  return rewards.total.map(({ denom, amount }) => [Number(amount), denom]);
}

async function testPendingReward(
  addr = 'agoric1ut8wc2l52layqq8lmxfvd9vwhdge2x5qsqrhrl',
) {
  const rows = await PendingReward(addr);
  console.log(rows);
}
