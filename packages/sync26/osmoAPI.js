const OsmoAPI = {
  tokens: 'https://api-osmosis.imperator.co/tokens/v2'
};

async function osmoPrice(token = 'BLD') {
    const fetch = makeFetch();
    const [{price}] = await fetch(`${OsmoAPI.tokens}/${token}`).then(r => r.json());
    return price;
}
