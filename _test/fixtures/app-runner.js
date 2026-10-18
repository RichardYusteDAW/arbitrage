import { createFakeSocket, product, level, bookMessage } from '../fixtures.js';

// This child process runs the actual entry point with no external requests.
const BaseSocket = createFakeSocket();
class Socket extends BaseSocket {
    send(text) {
        super.send(text);
        const message = JSON.parse(text);
        queueMicrotask(() => {
            if (this.closed) return;
            if (message.method === 'SUBSCRIBE') {
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
globalThis.fetch = async input => {
    const url = new URL(input);
    requested.push(url.toString());
    let data;
    if (url.hostname === 'api.binance.com' && url.pathname.endsWith('exchangeInfo')) {
        data = { symbols: [{ symbol: 'ETHUSDT', baseAsset: 'ETH', status: 'TRADING' }] };
    } else if (url.hostname === 'api.kraken.com' && url.pathname.endsWith('AssetPairs')) {
        data = { error: [], result: { ETHUSDT: { status: 'online', wsname: 'ETH/USDT' } } };
    } else if (url.hostname === 'api.coinbase.com' && url.pathname.endsWith('/products')) {
        data = { products: [product()], pagination: { has_next: false } };
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

await import('../../app.js');
const deadline = Date.now() + 2000;
while (Socket.instances.filter(socket => !socket.closed && socket.sent.length).length < 3) {
    if (Date.now() > deadline) throw new Error('App did not connect to all fake exchanges');
    await new Promise(resolve => setTimeout(resolve, 5));
}
await new Promise(resolve => setTimeout(resolve, 0));
const render = [...intervals.values()].find(interval => interval.delay === 1000);
render.callback();
process.emit(process.env.TEST_STOP_SIGNAL ?? 'SIGINT');
process.stdout.write(JSON.stringify({ logs, tables, requested,
    closed: Socket.instances.every(socket => socket.closed), activeIntervals: intervals.size }));
