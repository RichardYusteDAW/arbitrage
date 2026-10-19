import test from 'node:test';
import assert from 'node:assert/strict';
import QuoteStoreService from '../src/03-domain/services/quoteStoreService.js';
import { TickerData } from '../src/03-domain/models/ticker.js';
import { pair, ticker } from './fixtures.js';

test('el almacén devuelve modelos, copia las entradas y conserva la independencia de los exchanges', t => {
    t.mock.timers.enable({ apis: ['Date'], now: 1000 });
    const store = new QuoteStoreService(['a', 'b']);
    const input = ticker();
    store.update('a', [input]);
    const result = store.getData().a[0];
    assert.ok(result instanceof TickerData);
    assert.notEqual(result, input);
    assert.equal(result.receivedAt, 1000);
    assert.equal(input.receivedAt, undefined);
    assert.deepEqual(store.getData().b, []);
});

test('una actualización reemplaza el símbolo y una inválida elimina la cotización anterior', () => {
    const store = new QuoteStoreService(['a']);
    store.update('a', [ticker(), ticker({ askPrice: 102 })]);
    assert.equal(store.getData().a.length, 1);
    assert.equal(store.getData().a[0].askPrice, 102);
    store.update('a', [ticker({ askQty: 0 })]);
    assert.deepEqual(store.getData().a, []);
});

test('caducidad en el límite, retirada por grupo y limpieza completa', t => {
    t.mock.timers.enable({ apis: ['Date'], now: 1000 });
    const store = new QuoteStoreService(['a', 'b'], 100);
    store.update('a', [ticker(), ticker({ symbol: 'BTCUSDT', baseAsset: 'BTC' })]);
    store.update('b', [ticker()]);
    store.remove('a', [pair()]);
    assert.deepEqual(store.getData().a.map(value => value.symbol), ['BTCUSDT']);
    assert.equal(store.getData().b.length, 1);
    t.mock.timers.tick(100);
    assert.equal(store.getData().b.length, 1);
    t.mock.timers.tick(1);
    assert.deepEqual(store.getData().b, []);
    store.clear();
    assert.deepEqual(store.getData(), { a: [], b: [] });
});
