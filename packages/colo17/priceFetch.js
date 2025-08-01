const CoinGecko = {
  keyRange: 'priceKey',
  priceApi: 'https://pro-api.coingecko.com/api/v3/simple/price'
};

/**
 * ack: https://www.coingecko.com/en/api/documentation
 */
function FetchPrice(token='agoric', vs='usd') {
  console.warn('AMBIENT: UrlFetchApp');
  const { fetch } = UrlFetchApp;
  console.warn('AMBIENT: SpreadsheetApp');
  const doc = SpreadsheetApp.getActive();
  const apiKey = doc.getRangeByName(CoinGecko.keyRange).getValue();

  const url = `${CoinGecko.priceApi}?ids=${token}&vs_currencies=${vs}&x_cg_pro_api_key=${apiKey}`;

  const resp = fetch(url,
   { headers: {accept: 'application/json'}});
  const data = JSON.parse(resp.getContentText());
  // console.log(data);
  const price = data[token].usd;
  return price;
}
