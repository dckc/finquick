// @ts-check

// cribbed from
// [vest.rb](https://gist.github.com/arirubinstein/dbb3ceae360c8c38572e59c70fa5467d#file-vest-rb)

const get_price = async () => {
  const url =
    'https://api.coingecko.com/api/v3/simple/price?include_24hr_change=true&vs_currencies=usd&ids=agoric';
  const uri = new URL(url);
  const data = await fetch(uri).then(res => res.json());
  return data.agoric.usd;
};

/**
 * @param {string[]} args
 * @param {{ clock: () => Date }} io
 */
const main = async (args, { clock }) => {
  const [address, priceArg] = args;
  if (!address?.startsWith('agoric1')) {
    throw Error(`provide the address on CLI as an arg, and optionally a price afterwards.
	e.g. ruby vest.rb agoric1234123123 0.45`);
  }

  const price_per_bld = await (priceArg ? Number(priceArg) : get_price());

  const url = `https://api-agoric.nodes.guru/cosmos/auth/v1beta1/accounts/${address}`;
  const uri = new URL(url);
  const acct = await fetch(uri).then(res => res.json());

  if (
    acct['account']['@type'] !==
    '/cosmos.vesting.v1beta1.ClawbackVestingAccount'
  ) {
    throw Error('not a clawback');
  }

  [
    [
      'lockup',
      'unlocked',
      'can send on chain to anywhere, including exchanges',
    ],
    ['vesting', 'vested', 'can not be clawed back when leaving agoric'],
  ].forEach(vta => {
    const vt = vta[0];
    const start = acct['account']['start_time'];
    console.log(`${vta[0]} - ${vta[2]}`);
    let cum = Number(start);
    let cumb = 0;
    acct['account'][`${vt}_periods`].forEach(period => {
      cum = cum + Number(period['length']);
      cumb = cumb + Number(period['amount'][0]['amount']);
      if (clock().getTime() / 1000 > cum) {
        console.log('(past)   ');
      } else {
        console.log('(future) ');
      }
      console.log(
        `on ${new Date(cum * 1000)}\t${period['amount'][0]['amount']}${
          period['amount'][0]['denom']
        } becomes ${vta[1]} ($${
          (Number(period['amount'][0]['amount']) / 1000000) *
            price_per_bld /*.round(2)*/
        }),\ttotal ${cumb}ubld ${vta[1]} ($${
          (cumb / 1000000) * price_per_bld /*.round(2)*/
        })`,
      );
    });
    console.log();
  });
};

(async () => {
  main(process.argv.slice(2), { clock: () => new Date() });
})();
