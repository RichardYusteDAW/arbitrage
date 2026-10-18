import binanceAdapter from '../services/adapters/binance.js';
import krakenAdapter from '../services/adapters/kraken.js';
import coinbaseAdapter from '../services/adapters/coinbase.js';
import { ExchangeConfig } from '../models/exchange.js';

const EXCHANGES = {
  binance: new ExchangeConfig({
    websocketUrl: 'wss://stream.binance.com:9443/ws',
    pairsUrl: 'https://api.binance.com/api/v3/exchangeInfo',
    maxPairsPerConnection: 500,
    adapter: binanceAdapter
  }),
  coinbase: new ExchangeConfig({
    websocketUrl: 'wss://advanced-trade-ws.coinbase.com',
    pairsUrl: 'https://api.coinbase.com/api/v3/brokerage/market/products',
    maxPairsPerConnection: 25,
    adapter: coinbaseAdapter
  }),
  kraken: new ExchangeConfig({
    websocketUrl: 'wss://ws.kraken.com/v2',
    pairsUrl: 'https://api.kraken.com/0/public/AssetPairs',
    maxPairsPerConnection: 100,
    adapter: krakenAdapter
  })
};

export default EXCHANGES;