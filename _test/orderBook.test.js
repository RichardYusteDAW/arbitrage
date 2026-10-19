import test from 'node:test';
import assert from 'node:assert/strict';
import OrderBookService from '../src/03-domain/services/orderBookService.js';
import { level } from './fixtures.js';

test('libro vacío devuelve ceros y selecciona el mejor nivel independientemente del orden', () => {
    const book = new OrderBookService();
    assert.deepEqual(book.getBestPrices(), { bidPrice: 0, bidQty: 0, askPrice: 0, askQty: 0 });
    book.apply([level('bid', 98, 3), level('offer', 102, 5), level('bid', 99, 2), level('offer', 101, 4)]);
    assert.deepEqual(book.getBestPrices(), { bidPrice: 99, bidQty: 2, askPrice: 101, askQty: 4 });
});

test('cantidades absolutas reemplazan valores y eliminar el mejor nivel revela el siguiente', () => {
    const book = new OrderBookService();
    book.apply([level('bid', 99, 10), level('bid', 98, 20), level('offer', 101, 30), level('offer', 102, 40)]);
    book.apply([level('bid', 99, 2), level('offer', 101, 3)]);
    assert.equal(book.getBestPrices().bidQty, 2);
    assert.equal(book.getBestPrices().askQty, 3);
    book.apply([level('bid', 99, 0), level('offer', 101, 0)]);
    assert.deepEqual(book.getBestPrices(), { bidPrice: 98, bidQty: 20, askPrice: 102, askQty: 40 });
});

test('reset elimina todos los niveles y cada instancia mantiene su propio estado', () => {
    const first = new OrderBookService();
    const second = new OrderBookService();
    first.apply([level('bid', 99, 1)]);
    assert.equal(second.getBestPrices().bidPrice, 0);
    first.reset();
    assert.equal(first.getBestPrices().bidPrice, 0);
    assert.equal(first.bids.size, 0);
    assert.equal(first.asks.size, 0);
});
