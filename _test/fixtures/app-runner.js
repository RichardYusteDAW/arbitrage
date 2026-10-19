import { createFakeSocket, product, level, bookMessage } from '../fixtures.js';

// This child process runs the actual entry point with no external requests.
const BaseSocket = createFakeSocket();
class Socket extends BaseSocket {
    send(text) {
        super.send(text);
        const message = JSON.parse(text);
        queueMicrotask(() => {
            if (this.closed) return;
            if (message.channel === 'spot.book_ticker' && message.event === 'subscribe') {
                this.message({ channel: 'spot.book_ticker', event: 'update', result: { s: 'ETH_USDT', b: '100', B: '1', a: '101', A: '2' } });
            } else if (message.type === 'subscribe' && message.topic?.startsWith('/market/ticker:')) {
                this.message({ type: 'message', topic: '/market/ticker:ETH-USDT', data: { bestBid: '100', bestBidSize: '1', bestAsk: '101', bestAskSize: '2' } });
            } else if (message.op === 'subscribe' && typeof message.args[0] === 'string') {
                this.message({ topic: 'orderbook.1.ETHUSDT', type: 'snapshot', data: { s: 'ETHUSDT', b: [['100', '1']], a: [['101', '2']] } });
            } else if (message.op === 'subscribe' && message.args[0].topic === 'ticker') {
                this.message({ arg: { instType: 'spot', topic: 'ticker', symbol: 'ETHUSDT' }, action: 'snapshot', data: [{ bid1Price: '100', bid1Size: '1', ask1Price: '101', ask1Size: '2' }] });
            } else if (message.op === 'subscribe') {
                this.message({ arg: { channel: 'tickers' }, data: [{ instId: 'ETH-USDT', bidPx: '100', bidSz: '1', askPx: '101', askSz: '2' }] });
            } else if (message.method === 'SUBSCRIBE') {
                this.message({ s: 'ETHUSDT', b: '99', B: '1', a: '100', A: '2' });
            } else if (message.method === 'subscribe') {
                this.message({ channel: 'ticker', data: [{ symbol: 'ETH/USDT', bid: 103, bid_qty: 1, ask: 104, ask_qty: 2 }] });
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
    if (url.hostname === 'api.binance.com' && url.pathname.endsWith('exchangeInfo')) {
        data = { symbols: [{ symbol: 'ETHUSDT', baseAsset: 'ETH', status: 'TRADING' }] };
    } else if (url.hostname === 'api.kraken.com' && url.pathname.endsWith('AssetPairs')) {
        data = { error: [], result: { ETHUSDT: { status: 'online', wsname: 'ETH/USDT' } } };
    } else if (url.hostname === 'api.coinbase.com' && url.pathname.endsWith('/products')) {
        data = { products: [product()], pagination: { has_next: false } };
    } else if (url.hostname === 'www.okx.com' && url.pathname.endsWith('/instruments')) {
        data = { code: '0', data: [{ instType: 'SPOT', state: 'live', instId: 'ETH-USDT', baseCcy: 'ETH', quoteCcy: 'USDT' }] };
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
const logs = [];
const tables = [];
console.log = (...values) => logs.push(values.join(' '));
console.table = rows => tables.push(rows);

await import('../../src/app.js');
const deadline = Date.now() + 2000;
while (Socket.instances.filter(socket => !socket.closed && socket.sent.length).length < 8) {
    if (Date.now() > deadline) throw new Error('App did not connect to all fake exchanges');
    await new Promise(resolve => setTimeout(resolve, 5));
}
await new Promise(resolve => setTimeout(resolve, 0));
const render = [...intervals.values()].find(interval => interval.delay === 1000);
render.callback();
process.emit(process.env.TEST_STOP_SIGNAL ?? 'SIGINT');
process.stdout.write(JSON.stringify({ logs, tables, requested,
    closed: Socket.instances.every(socket => socket.closed), activeIntervals: intervals.size }));
