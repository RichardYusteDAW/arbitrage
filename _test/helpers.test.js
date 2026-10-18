import test from 'node:test';
import assert from 'node:assert/strict';
import { getBinanceData } from '../helpers/binance.js';
import { getKrakenData } from '../helpers/kraken.js';
import { getCoinbaseData, loadCoinbaseData } from '../helpers/coinbase.js';
import { product, flush } from './fixtures.js';

test('helper Binance filtra pares activos, conserva los datos y añade baseAsset', () => {
    const tickers = [{ symbol: 'ETHUSDT', askPrice: '100', askQty: '2' }, { symbol: 'OFF' }, { symbol: 'UNKNOWN' }];
    const before = structuredClone(tickers);
    assert.deepEqual(getBinanceData(tickers, [{ symbol: 'ETHUSDT', status: 'TRADING', baseAsset: 'ETH' }, { symbol: 'OFF', status: 'BREAK' }]),
        [{ ...tickers[0], baseAsset: 'ETH' }]);
    assert.deepEqual(tickers, before);
});

test('helper Kraken normaliza aliases y descarta pares offline, desconocidos o sin wsname', () => {
    const quote = { a: ['100', '2', '2'], b: ['99', '1', '1'] };
    const result = getKrakenData({
        a: { status: 'online', wsname: 'XBT/USDT' }, b: { status: 'online', wsname: 'XDG/USDT' },
        c: { status: 'offline', wsname: 'ETH/USD' }, d: { status: 'online' }
    }, { a: quote, b: quote, c: quote, d: quote, unknown: quote });
    assert.equal(result.length, 2);
    assert.equal(result[0].symbol, 'BTCUSDT');
    assert.equal(result[1].baseAsset, 'DOGE');
    assert.equal(result[0].askPrice, 100);
});

test('helper Coinbase usa el libro en vez del precio del listado y descarta libros vacíos', () => {
    const pricebook = { bids: [{ price: '99', size: '0.5' }], asks: [{ price: '100', size: '0.75' }] };
    assert.deepEqual(getCoinbaseData([product('ETH-USDT', { pricebook, best_bid_price: '1' }),
        product('BTC-USD', { pricebook: { bids: [], asks: [] } }), product('OFF-USD', { trading_disabled: true, pricebook }), product('MISSING-USD')]),
        [{ symbol: 'ETHUSDT', baseAsset: 'ETH', bidPrice: 99, bidQty: 0.5, askPrice: 100, askQty: 0.75 }]);
});

test('cargador REST Coinbase pagina y limita a tres las peticiones de libros', async () => {
    let active = 0;
    let maxActive = 0;
    const seen = [];
    const result = await loadCoinbaseData('https://example.com/products', async input => {
        const url = new URL(input);
        seen.push(url);
        if (url.pathname.endsWith('/products')) return url.searchParams.has('cursor')
            ? { products: [product('D-USD'), product('OFF-USD', { is_disabled: true })], pagination: { has_next: false } }
            : { products: ['A', 'B', 'C'].map(base => product(base + '-USD')), pagination: { has_next: true, next_cursor: 'second' } };
        assert.equal(url.searchParams.get('limit'), '1');
        active++; maxActive = Math.max(maxActive, active);
        await flush(); active--;
        return { pricebook: { bids: [{ price: '99', size: '1' }], asks: [{ price: '100', size: '2' }] } };
    });
    assert.equal(result.length, 4);
    assert.equal(getCoinbaseData(result).length, 4);
    assert.equal(maxActive, 3);
    assert.equal(seen.filter(url => url.pathname.endsWith('product_book')).length, 4);
    assert.equal(seen[1].searchParams.get('cursor'), 'second');
});

test('cargador REST Coinbase rechaza cursores repetidos y errores HTTP no recuperables', async () => {
    await assert.rejects(loadCoinbaseData('https://example.com/products', async () => ({ products: [], pagination: { has_next: true, next_cursor: 'same' } })), /pagination cursor/);
    await assert.rejects(loadCoinbaseData('https://example.com/products', async url => {
        if (url.includes('product_book')) throw Object.assign(new Error('Forbidden'), { status: 403 });
        return { products: [product()] };
    }), /Forbidden/);
});

test('cargador REST Coinbase reintenta HTTP 429 y se detiene tras tres intentos', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let attempts = 0;
    const request = async url => {
        if (!url.includes('product_book')) return { products: [product()] };
        attempts++;
        throw Object.assign(new Error('Too many requests'), { status: 429 });
    };
    const completed = assert.rejects(loadCoinbaseData('https://example.com/products', request), /Too many requests/);
    await flush();
    t.mock.timers.tick(1000);
    await flush();
    t.mock.timers.tick(1000);
    await completed;
    assert.equal(attempts, 3);
});
