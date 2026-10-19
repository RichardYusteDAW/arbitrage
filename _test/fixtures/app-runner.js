process.env.OKX_API_BASE_URL = 'https://www.okx.com';
process.env.OKX_API_KEY = 'test-okx-key';
process.env.OKX_API_SECRET = 'test-okx-secret';
process.env.OKX_API_PASSPHRASE = 'test-okx-passphrase';
process.env.BYBIT_API_KEY = 'test-bybit-key';
process.env.BYBIT_API_SECRET = 'test-bybit-secret';
process.env.KRAKEN_API_KEY = 'test-kraken-key';
process.env.KRAKEN_API_SECRET = 'dGVzdC1zZWNyZXQ=';
process.env.BINANCE_API_KEY = 'test-binance-key';
process.env.BINANCE_API_SECRET = 'test-binance-secret';
import { createFakeSocket, product, level, bookMessage } from '../fixtures.js';

// This child process runs the actual entry point with no external requests.
const BaseSocket = createFakeSocket();
class Socket extends BaseSocket {
    send(text) {
        super.send(text);
        const message = JSON.parse(text);
        queueMicrotask(() => {
            if (this.closed) return;
            if (message.event === 'bts:subscribe') {
                this.message({ event: 'data', channel: message.data.channel, data: { bids: [['100', '1']], asks: [['101', '2']] } });
            } else if (message.action === 'getBook') {
                this.message({ action: 'getBook', response: { market: message.market, nonce: 1, bids: [['100', '1']], asks: [['101', '2']] } });
            } else if (message.event === 'subscribe' && message.channel === 'book') {
                this.message({ event: 'subscribed', channel: 'book', chanId: 1, symbol: message.symbol });
                this.message([1, [[100, 1, 1], [101, 1, -2]]]);
            } else if (message.method === 'subscribe' && Array.isArray(message.params)) {
                this.message({ symbol: 'ethusdt', bids: [['100', '1']], asks: [['101', '2']] });
            } else if (message.method === 'subscribe' && message.params?.channels) {
                this.message({ code: 0, result: { channel: 'book', instrument_name: 'ETH_USDT', data: [{ bids: [['100', '1']], asks: [['101', '2']] }] } });
            } else if (message.channel === 'spot.order_book' && message.event === 'subscribe') {
                this.message({ channel: 'spot.order_book', event: 'update', result: { s: 'ETH_USDT', bids: [['100', '1']], asks: [['101', '2']] } });
            } else if (message.type === 'subscribe' && message.topic?.startsWith('/spotMarket/level2Depth50:')) {
                this.message({ type: 'message', topic: '/spotMarket/level2Depth50:ETH-USDT', data: { bids: [['100', '1']], asks: [['101', '2']] } });
            } else if (message.op === 'subscribe' && typeof message.args[0] === 'string') {
                this.message({ topic: 'orderbook.50.ETHUSDT', type: 'snapshot', data: { s: 'ETHUSDT', b: [['100', '1']], a: [['101', '2']] } });
            } else if (message.op === 'subscribe' && message.args[0].topic === 'books5') {
                this.message({ arg: { instType: 'spot', topic: 'books5', symbol: 'ETHUSDT' }, action: 'snapshot', data: [{ b: [['100', '1']], a: [['101', '2']] }] });
            } else if (message.op === 'subscribe') {
                this.message({ arg: { channel: 'books5' }, data: [{ instId: 'ETH-USDT', bids: [['100', '1']], asks: [['101', '2']] }] });
            } else if (message.method === 'SUBSCRIBE') {
                this.message({ stream: 'ethusdt@depth20@100ms', data: { bids: [['99', '1']], asks: [['100', '2']] } });
            } else if (message.method === 'subscribe') {
                this.message({ channel: 'book', type: 'snapshot', data: [{ symbol: 'ETH/USDT', bids: [{ price: 103, qty: 1 }], asks: [{ price: 104, qty: 2 }] }] });
            } else if (message.channel === 'heartbeats') {
                this.message({ channel: 'subscriptions', sequence_num: 0 });
            } else if (message.channel === 'level2') {
                this.message(bookMessage(1, 'snapshot', [level('bid', 101, 0.5), level('offer', 102, 0.75)]));
            }
        });
    }
}

globalThis.WebSocket = Socket;
const requested = [];
globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    requested.push(url.toString());
    let data;
    if (url.hostname === 'www.bitstamp.net' && url.pathname.endsWith('/markets/')) {
        data = [{ market_symbol: 'ethusdt', market_type: 'SPOT', trading: 'Enabled', base_currency: 'ETH', counter_currency: 'USDT' }];
    } else if (url.hostname === 'www.bitstamp.net' && url.pathname.endsWith('/currencies/')) {
        data = [{ currency: 'ETH', type: 'crypto', deposit: 'Enabled', withdrawal: 'Enabled' }];
    } else if (url.hostname === 'api.bitvavo.com' && url.pathname.endsWith('/markets')) {
        data = [{ market: 'ETH-USDT', status: 'trading', base: 'ETH', quote: 'USDT' }];
    } else if (url.hostname === 'api.bitvavo.com' && url.pathname.endsWith('/assets')) {
        data = [{ symbol: 'ETH', withdrawalStatus: 'OK', depositStatus: 'OK' }];
    } else if (url.hostname === 'api.crypto.com') {
        data = { code: 0, result: { data: [{ symbol: 'ETH_USDT', inst_type: 'CCY_PAIR', tradable: true, product_type: 'DIGITAL_CURRENCIES', base_ccy: 'ETH', quote_ccy: 'USDT' }] } };
    } else if (url.hostname === 'api.gemini.com') {
        data = ['ethusdt'];
    } else if (url.hostname === 'api-pub.bitfinex.com' && url.pathname.includes('pub:list:pair:exchange')) {
        data = [['ETHUST'], [['UST', 'USDt']], []];
    } else if (url.hostname === 'api-pub.bitfinex.com') {
        data = [[['ETHEREUM', ['ETH']]], [['ETHEREUM', 1, 1]], []];
    } else if (url.hostname === 'api.binance.com' && url.pathname.endsWith('/time')) {
        data = { serverTime: Date.now() };
    } else if (url.hostname === 'api.binance.com' && url.pathname.endsWith('/capital/config/getall')) {
        if (options.headers['X-MBX-APIKEY'] !== 'test-binance-key') throw new Error('Missing test API key');
        data = [{ coin: 'ETH', withdrawAllEnable: true, networkList: [{ withdrawEnable: true, depositEnable: true }] }];
    } else if (url.hostname === 'api.binance.com' && url.pathname.endsWith('exchangeInfo')) {
        data = { symbols: [{ symbol: 'ETHUSDT', baseAsset: 'ETH', status: 'TRADING' }] };
    } else if (url.hostname === 'api.kraken.com' && ['/funding/v1/methods/withdraw', '/funding/v1/methods/deposit'].includes(url.pathname)) {
        if (options.headers['API-Key'] !== 'test-kraken-key') throw new Error('Missing Kraken test key');
        data = { methods: [{ asset: { class: 'currency', name: 'ETH' } }] };
    } else if (url.hostname === 'api.kraken.com' && url.pathname.endsWith('/Assets')) {
        data = { error: [], result: { XETH: { altname: 'ETH', status: 'enabled' } } };
    } else if (url.hostname === 'api.kraken.com' && url.pathname.endsWith('AssetPairs')) {
        data = { error: [], result: { ETHUSDT: { status: 'online', wsname: 'ETH/USDT' } } };
    } else if (url.hostname === 'api.coinbase.com' && url.pathname.endsWith('/products')) {
        data = { products: [product()], pagination: { has_next: false } };
    } else if (url.hostname === 'www.okx.com' && url.pathname.endsWith('/public/time')) {
        data = { code: '0', data: [{ ts: String(Date.now()) }] };
    } else if (url.hostname === 'www.okx.com' && url.pathname.endsWith('/asset/currencies')) {
        if (options.headers['OK-ACCESS-KEY'] !== 'test-okx-key') throw new Error('Missing OKX test key');
        if (options.headers['OK-ACCESS-PASSPHRASE'] !== 'test-okx-passphrase') throw new Error('Missing OKX test passphrase');
        data = { code: '0', data: [{ ccy: 'ETH', chain: 'ETH-Ethereum', canWd: true, canDep: true }] };
    } else if (url.hostname === 'www.okx.com' && url.pathname.endsWith('/instruments')) {
        data = { code: '0', data: [{ instType: 'SPOT', state: 'live', instId: 'ETH-USDT', baseCcy: 'ETH', quoteCcy: 'USDT' }] };
    } else if (url.hostname === 'api.bybit.com' && url.pathname.endsWith('/market/time')) {
        data = { retCode: 0, time: Date.now() };
    } else if (url.hostname === 'api.bybit.com' && url.pathname.endsWith('/coin/query-info')) {
        if (options.headers['X-BAPI-API-KEY'] !== 'test-bybit-key') throw new Error('Missing Bybit test key');
        data = { retCode: 0, result: { rows: [{ coin: 'ETH', chains: [{ chainWithdraw: '1', chainDeposit: '1', withdrawFee: '0' }] }] } };
    } else if (url.hostname === 'api.bybit.com' && url.pathname.endsWith('/instruments-info')) {
        data = { retCode: 0, result: { list: [{ symbol: 'ETHUSDT', baseCoin: 'ETH', quoteCoin: 'USDT', status: 'Trading' }] } };
    } else if (url.hostname === 'api.bitget.com' && url.pathname.endsWith('/instruments')) {
        data = { code: '00000', data: [{ category: 'SPOT', symbol: 'ETHUSDT', baseCoin: 'ETH', quoteCoin: 'USDT', status: 'online' }] };
    } else if (url.hostname === 'api.kucoin.com' && url.pathname.endsWith('/symbols')) {
        data = { code: '200000', data: [{ symbol: 'ETH-USDT', baseCurrency: 'ETH', quoteCurrency: 'USDT', enableTrading: true }] };
    } else if (url.hostname === 'api.kucoin.com' && url.pathname.endsWith('/bullet-public')) {
        if (options.method !== 'POST') throw new Error('Token request must use POST');
        data = { code: '200000', data: { token: 'test-token', instanceServers: [{ endpoint: 'wss://ws-api-spot.kucoin.com', protocol: 'websocket', encrypt: true, pingInterval: 18000, pingTimeout: 10000 }] } };
    } else if (url.hostname === 'api.gateio.ws' && url.pathname.endsWith('/currency_pairs')) {
        data = [{ id: 'ETH_USDT', base: 'ETH', quote: 'USDT', trade_status: 'tradable', type: 'normal' }];
    } else if (url.hostname === 'api.kucoin.com' && url.pathname.endsWith('/currencies')) {
        data = { code: '200000', data: [{ currency: 'ETH', chains: [{ isWithdrawEnabled: true, isDepositEnabled: false }] }] };
    } else if (url.hostname === 'api.gateio.ws' && url.pathname.endsWith('/currencies')) {
        data = [{ currency: 'ETH', chains: [{ withdraw_disabled: false, withdraw_delayed: false, deposit_disabled: false }] }];
    } else if (url.hostname === 'api.bitget.com' && url.pathname.endsWith('/coins')) {
        data = { code: '00000', data: [{ coin: 'ETH', chains: [{ withdrawable: 'false', rechargeable: 'true' }] }] };
    } else {
        throw new Error(`Unexpected request: ${url}`);
    }
    return { ok: true, json: async () => data };
};

const intervals = new Map();
let nextInterval = 0;
globalThis.setInterval = (callback, delay) => {
    const id = ++nextInterval;
    intervals.set(id, { callback, delay });
    return id;
};
globalThis.clearInterval = id => intervals.delete(id);
const writeOutput = process.stdout.write.bind(process.stdout);
const screenClears = [];
process.stdout.write = text => { screenClears.push(text); return true; };
const logs = [];
const tables = [];
console.log = (...values) => logs.push(values.join(' '));
console.table = rows => tables.push(rows);

await import('../../src/app.js');
const deadline = Date.now() + 5000;
while (Socket.instances.filter(socket => !socket.closed && socket.sent.length).length < 13) {
    if (Date.now() > deadline) throw new Error('App did not connect to all fake exchanges');
    await new Promise(resolve => setTimeout(resolve, 5));
}
await new Promise(resolve => setTimeout(resolve, 0));
const render = [...intervals.values()].find(interval => interval.delay === 1000);
render.callback();
process.emit(process.env.TEST_STOP_SIGNAL ?? 'SIGINT');
writeOutput(JSON.stringify({ logs, tables, requested, screenClears,
    closed: Socket.instances.every(socket => socket.closed), activeIntervals: intervals.size }));
