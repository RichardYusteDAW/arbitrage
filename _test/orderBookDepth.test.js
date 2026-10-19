import test from 'node:test';
import assert from 'node:assert/strict';
import kraken from '../src/03-domain/services/adapters/kraken.js';
import bybit from '../src/03-domain/services/adapters/bybit.js';
import { pair } from './fixtures.js';

test('Bybit aplica cambios parciales, conserva el otro lado y reinicia con un snapshot nuevo', () => {
    const parse = bybit.createParser([pair()]);
    const message = (type, b, a, u) => ({ type, topic: 'orderbook.50.ETHUSDT', data: { s: 'ETHUSDT', b, a, u } });
    const first = parse(message('snapshot', [[99, 1], [98, 2]], [[100, 3], [101, 4]], 10))[0];
    const updated = parse(message('delta', [[99, 0]], [[100, 5]], 11))[0];
    assert.deepEqual(updated.bids, [[98, 2]]);
    assert.deepEqual(updated.asks, [[100, 5], [101, 4]]);
    assert.deepEqual(first.bids, [[99, 1], [98, 2]]);
    const reset = parse(message('snapshot', [[90, 1]], [[110, 2]], 1))[0];
    assert.deepEqual(reset.asks, [[110, 2]]);
    assert.deepEqual(reset.bids, [[90, 1]]);
});

test('Kraken recorta niveles fuera de profundidad para que no reaparezcan tras borrar el mejor', () => {
    const parse = kraken.createParser([pair('ETHUSD', 'ETH', 'ETH/USD')]);
    const message = (type, asks, bids = []) => ({ channel: 'book', type, data: [{ symbol: 'ETH/USD', asks, bids }] });
    parse(message('snapshot', Array.from({ length: 25 }, (_, index) => ({ price: 100 + index, qty: 1 })), [{ price: 90, qty: 1 }]));
    const inserted = parse(message('update', [{ price: 99, qty: 2 }]))[0];
    assert.equal(inserted.asks.length, 25);
    assert.equal(inserted.asks.at(-1)[0], 123);
    const deleted = parse(message('update', [{ price: 99, qty: 0 }]))[0];
    assert.equal(deleted.asks.length, 24);
    assert.equal(deleted.asks.at(-1)[0], 123);
    assert.throws(() => kraken.createParser([pair('ETHUSD', 'ETH', 'ETH/USD')])(
        message('update', [{ price: 100, qty: 1 }])
    ), /before snapshot/);
});
