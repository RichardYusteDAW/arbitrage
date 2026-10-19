import { setImmediate } from 'node:timers/promises';
import { ExchangePair } from '../src/03-domain/models/exchange.js';
import { TickerData } from '../src/03-domain/models/ticker.js';

export const flush = () => setImmediate();
export const pair = (symbol = 'ETHUSDT', baseAsset = 'ETH', id = symbol) => new ExchangePair({ id, symbol, baseAsset });
export const ticker = (changes = {}) => {
    const data = { symbol: 'ETHUSDT', baseAsset: 'ETH', askPrice: 100, askQty: 2, bidPrice: 99, bidQty: 1, ...changes };
    return new TickerData({ ...data, bids: data.bids ?? [[data.bidPrice, data.bidQty]], asks: data.asks ?? [[data.askPrice, data.askQty]] });
};
export const product = (id = 'ETH-USDT', changes = {}) => ({ product_id: id,
    base_currency_id: id.split('-')[0], quote_currency_id: id.split('-')[1],
    product_type: 'SPOT', status: 'online', ...changes });
export const level = (side, price, quantity) => ({ side, price_level: String(price), new_quantity: String(quantity) });
export const bookMessage = (sequence, type, updates, id = 'ETH-USDT') => ({ channel: 'l2_data', sequence_num: sequence,
    events: [{ type, product_id: id, updates }] });

export const createFakeSocket = ({ autoOpen = true } = {}) => class FakeSocket extends EventTarget {
    static instances = [];
    sent = [];
    closed = false;
    constructor(url) {
        super();
        this.url = url;
        this.constructor.instances.push(this);
        if (autoOpen) queueMicrotask(() => { if (!this.closed) this.open(); });
    }
    open() { this.dispatchEvent(new Event('open')); }
    send(message) { this.sent.push(JSON.parse(message)); }
    close() {
        if (this.closed) return;
        this.closed = true;
        this.dispatchEvent(Object.assign(new Event('close'), { code: 1000 }));
    }
    message(data) { this.raw(JSON.stringify(data)); }
    raw(data) { this.dispatchEvent(new MessageEvent('message', { data })); }
};
