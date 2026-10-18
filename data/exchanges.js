import { getCoinbaseData, loadCoinbaseData } from '../coinbase.js';
import { getBinanceData } from '../helpers/binance.js';
import { getKrakenData } from '../helpers/kraken.js';

const EXCHANGES = {
  binance: {
    url: 'https://api.binance.com/api/v3/ticker/bookTicker',
    pairsUrl: 'https://api.binance.com/api/v3/exchangeInfo',
    normalize: (data, pairs) => getBinanceData(data, pairs.symbols)
  },
  coinbase: {
    url: 'https://api.coinbase.com/api/v3/brokerage/market/products',
    load: loadCoinbaseData,
    normalize: getCoinbaseData
  },
  kraken: {
    url: 'https://api.kraken.com/0/public/Ticker',
    pairsUrl: 'https://api.kraken.com/0/public/AssetPairs',
    validate: res => {
      if (res.error?.length)
        throw new Error(`kraken: ${res.error.join(', ')}`);
    },
    normalize: (data, pairs) => getKrakenData(pairs.result, data.result)
  }
};

export default EXCHANGES;