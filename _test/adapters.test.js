import test from 'node:test';
import assert from 'node:assert/strict';
import binance from '../services/adapters/binance.js';
import kraken from '../services/adapters/kraken.js';
import coinbase from '../services/adapters/coinbase.js';
import { pair, ticker, product, level, bookMessage } from './fixtures.js';

test('Binance descubre solo pares activos y habilitados para spot', async () => {
    const result = await binance.discover({ pairsUrl: 'metadata' }, async url => {
        assert.equal(url, 'metadata');
        return { symbols: [{ symbol: 'ETHUSDT', baseAsset: 'ETH', status: 'TRADING' },
            { symbol: 'OFF', status: 'BREAK' }, { symbol: 'NO_SPOT', status: 'TRADING', isSpotTradingAllowed: false }] };
    });
    assert.deepEqual(result, [pair()]);
});

test('Binance suscribe bookTicker, normaliza mensajes directos y combinados y propaga errores', () => {
    assert.deepEqual(binance.subscriptions([pair()]), [{ method: 'SUBSCRIBE', params: ['ethusdt@bookTicker'], id: 1 }]);
    const parse = binance.createParser([pair()]);
    const message = { s: 'ETHUSDT', b: '99', B: '0.5', a: '100', A: '0.75' };
    const expected = [ticker({ bidQty: 0.5, askQty: 0.75 })];
    assert.deepEqual(parse(message), expected);
    assert.deepEqual(parse({ data: message }), expected);
    assert.deepEqual(parse({ result: null, id: 1 }), []);
    assert.deepEqual(parse({ ...message, s: 'UNKNOWN' }), []);
    assert.throws(() => parse({ code: 2, msg: 'Invalid subscription' }), /Invalid subscription/);
});

test('Kraken filtra pares y conserva los aliases XBT y XDG', async () => {
    const result = await kraken.discover({}, async () => ({ error: [], result: {
        a: { status: 'online', wsname: 'XBT/USDT' }, b: { status: 'online', wsname: 'XDG/USDT' },
        c: { status: 'offline', wsname: 'ETH/USD' }, d: { status: 'online' }
    } }));
    assert.deepEqual(result, [pair('BTCUSDT', 'BTC', 'BTC/USDT'), pair('DOGEUSDT', 'DOGE', 'DOGE/USDT')]);
    await assert.rejects(kraken.discover({}, async () => ({ error: ['EService:Unavailable'] })), /Unavailable/);
});

test('Kraken suscribe snapshots BBO y normaliza cantidades fraccionarias', () => {
    const pairs = [pair('ETHUSDT', 'ETH', 'ETH/USDT')];
    const subscription = kraken.subscriptions(pairs)[0];
    assert.equal(subscription.params.event_trigger, 'bbo');
    assert.equal(subscription.params.snapshot, true);
    assert.deepEqual(subscription.params.symbol, ['ETH/USDT']);
    assert.deepEqual(kraken.heartbeat(), { method: 'ping' });
    const parse = kraken.createParser(pairs);
    assert.deepEqual(parse({ channel: 'heartbeat' }), []);
    const result = parse({ channel: 'ticker', data: [{ symbol: 'ETH/USDT', bid: 99, bid_qty: 0.25, ask: 100, ask_qty: 0.5 },
        { symbol: 'UNKNOWN' }] });
    assert.equal(result.length, 1);
    assert.equal(result[0].bidQty, 0.25);
    assert.equal(result[0].askQty, 0.5);
    assert.throws(() => parse({ success: false, error: 'Unknown pair' }), /Unknown pair/);
});

test('Coinbase pagina, elimina duplicados y aliases y filtra mercados restringidos', async () => {
    const urls = [];
    const result = await coinbase.discover({ pairsUrl: 'https://example.com/products?product_type=SPOT' }, async url => {
        urls.push(new URL(url));
        return urls.length === 1
            ? { products: [product('ETH-USD'), product('ETH-USDC', { alias: 'ETH-USD' })], pagination: { has_next: true, next_cursor: 'next' } }
            : { products: [product('ETH-USD'), product('ETH-USDT'),
                ...['trading_disabled', 'is_disabled', 'view_only', 'cancel_only', 'limit_only', 'post_only'].map(flag => product(flag + '-USD', { [flag]: true })),
                product('OFF-USD', { status: 'offline' }), product('FUTURE-USD', { product_type: 'FUTURE' })], pagination: { has_next: false } };
    });
    assert.deepEqual(result.map(value => value.id), ['ETH-USD', 'ETH-USDT']);
    assert.equal(urls[1].searchParams.get('cursor'), 'next');
    assert.equal(urls[1].searchParams.get('product_type'), 'SPOT');
});

test('Coinbase rechaza cursores ausentes o repetidos', async () => {
    for (const cursor of [undefined, 'repeat']) {
        await assert.rejects(coinbase.discover({ pairsUrl: 'https://example.com/products' }, async () =>
            ({ products: [], pagination: { has_next: true, next_cursor: cursor } })), /pagination cursor/);
    }
});

test('Coinbase suscribe heartbeats y level2 con identificadores nativos', () => {
    assert.deepEqual(coinbase.subscriptions([pair('ETHUSDT', 'ETH', 'ETH-USDT')]), [
        { type: 'subscribe', channel: 'heartbeats' }, { type: 'subscribe', channel: 'level2', product_ids: ['ETH-USDT'] }
    ]);
});

test('Coinbase aplica tamaños absolutos, elimina niveles y cuenta los mensajes de control', () => {
    const parse = coinbase.createParser([pair('ETHUSDT', 'ETH', 'ETH-USDT')]);
    parse({ channel: 'subscriptions', sequence_num: 0 });
    let [result] = parse(bookMessage(1, 'snapshot', [level('bid', 99, 2), level('bid', 98, 3), level('offer', 101, 4), level('offer', 102, 5)]));
    assert.equal(result.bidPrice, 99);
    assert.equal(result.askPrice, 101);
    parse({ channel: 'heartbeats', sequence_num: 2 });
    [result] = parse(bookMessage(3, 'update', [level('bid', 99, 0), level('offer', 101, 1)]));
    assert.equal(result.bidPrice, 98);
    assert.equal(result.bidQty, 3);
    assert.equal(result.askQty, 1);
    [result] = parse(bookMessage(4, 'update', [level('offer', 101, 0)]));
    assert.equal(result.askPrice, 102);
    assert.equal(result.askQty, 5);
    [result] = parse(bookMessage(5, 'snapshot', [level('bid', 90, 1), level('offer', 110, 1)]));
    assert.equal(result.bidPrice, 90);
    assert.equal(result.askPrice, 110);
});

test('Coinbase detecta huecos de secuencia, actualizaciones sin snapshot y errores del servidor', () => {
    const pairs = [pair('ETHUSDT', 'ETH', 'ETH-USDT')];
    const parse = coinbase.createParser(pairs);
    parse(bookMessage(0, 'snapshot', []));
    assert.throws(() => parse(bookMessage(2, 'update', [])), /sequence gap/);
    assert.throws(() => coinbase.createParser(pairs)(bookMessage(0, 'update', [])), /before snapshot/);
    assert.throws(() => parse({ type: 'error', message: 'Denied' }), /Denied/);
});

test('los libros de Coinbase se mantienen separados por producto y se vacían correctamente', () => {
    const parse = coinbase.createParser([pair('ETHUSDT', 'ETH', 'ETH-USDT'), pair('BTCUSD', 'BTC', 'BTC-USD')]);
    parse(bookMessage(0, 'snapshot', [level('bid', 99, 2), level('offer', 101, 3)]));
    const [btc] = parse(bookMessage(1, 'snapshot', [level('bid', 1000, 1), level('offer', 1001, 1)], 'BTC-USD'));
    assert.equal(btc.baseAsset, 'BTC');
    const [eth] = parse(bookMessage(2, 'update', [level('bid', 99, 0), level('offer', 101, 0)]));
    assert.equal(eth.bidPrice, 0);
    assert.equal(eth.askPrice, 0);
    assert.equal(eth.askQty, 0);
    assert.deepEqual(parse(bookMessage(3, 'snapshot', [], 'UNKNOWN')), []);
});
