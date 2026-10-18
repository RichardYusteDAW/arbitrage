import binanceAdapter from '../services/adapters/binance.js';
import krakenAdapter from '../services/adapters/kraken.js';
import coinbaseAdapter from '../services/adapters/coinbase.js';

/** @type {import('../models/exchange.js').ExchangesConfig} */
const EXCHANGES = {
  binance: {
    websocketUrl: 'wss://stream.binance.com:9443/ws',
    pairsUrl: 'https://api.binance.com/api/v3/exchangeInfo',
    maxPairsPerConnection: 500,
    adapter: binanceAdapter
  },
  coinbase: {
    websocketUrl: 'wss://advanced-trade-ws.coinbase.com',
    pairsUrl: 'https://api.coinbase.com/api/v3/brokerage/market/products',
    maxPairsPerConnection: 25,
    adapter: coinbaseAdapter
  },
  kraken: {
    websocketUrl: 'wss://ws.kraken.com/v2',
    pairsUrl: 'https://api.kraken.com/0/public/AssetPairs',
    maxPairsPerConnection: 100,
    adapter: krakenAdapter
  }
};

export default EXCHANGES;
