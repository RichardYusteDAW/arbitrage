import gateioAdapter from './03-domain/services/adapters/gateio.js';
import kucoinAdapter from './03-domain/services/adapters/kucoin.js';
import bitgetAdapter from './03-domain/services/adapters/bitget.js';
import bybitAdapter from './03-domain/services/adapters/bybit.js';
import okxAdapter from './03-domain/services/adapters/okx.js';
import binanceAdapter from './03-domain/services/adapters/binance.js';
import krakenAdapter from './03-domain/services/adapters/kraken.js';
import coinbaseAdapter from './03-domain/services/adapters/coinbase.js';
import { ExchangeConfig } from './03-domain/models/exchange.js';

const EXCHANGES = {
  gateio: new ExchangeConfig({
    websocketUrl: 'wss://api.gateio.ws/ws/v4/',
    pairsUrl: 'https://api.gateio.ws/api/v4/spot/currency_pairs',
    maxPairsPerConnection: 100,
    adapter: gateioAdapter
  }),
  kucoin: new ExchangeConfig({
    websocketUrl: 'wss://ws-api-spot.kucoin.com',
    pairsUrl: 'https://api.kucoin.com/api/v2/symbols',
    maxPairsPerConnection: 100,
    adapter: kucoinAdapter
  }),
  bitget: new ExchangeConfig({
    websocketUrl: 'wss://ws.bitget.com/v3/ws/public',
    pairsUrl: 'https://api.bitget.com/api/v3/market/instruments?category=SPOT',
    maxPairsPerConnection: 100,
    adapter: bitgetAdapter
  }),
  bybit: new ExchangeConfig({
    websocketUrl: 'wss://stream.bybit.com/v5/public/spot',
    pairsUrl: 'https://api.bybit.com/v5/market/instruments-info?category=spot',
    maxPairsPerConnection: 100,
    adapter: bybitAdapter
  }),
  okx: new ExchangeConfig({
    websocketUrl: 'wss://ws.okx.com/ws/v5/public',
    pairsUrl: 'https://www.okx.com/api/v5/public/instruments?instType=SPOT',
    maxPairsPerConnection: 100,
    adapter: okxAdapter
  }),
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
    withdrawalRefreshInterval: 60000,
    renderInterval: 1000
};

export { EXCHANGES, TIMING };