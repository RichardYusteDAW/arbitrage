import binanceAdapter from './03-domain/services/adapters/binance.js';
import krakenAdapter from './03-domain/services/adapters/kraken.js';
import coinbaseAdapter from './03-domain/services/adapters/coinbase.js';
import { ExchangeConfig } from './03-domain/models/exchange.js';

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

// Todos los tiempos se expresan en milisegundos.
const TIMING = {
    requestTimeout: 15000,
    connectionTimeout: 15000,
    inactivityTimeout: 45000,
    heartbeatInterval: 20000,
    reconnectDelay: 1000,
    maxReconnectDelay: 30000,
    stableConnectionDuration: 60000,
    discoveryRetryDelay: 10000,
    connectionStagger: 500,
    quoteMaxAge: 30000,
    renderInterval: 1000
};

export { EXCHANGES, TIMING };