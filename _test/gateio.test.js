import test from 'node:test';
import assert from 'node:assert/strict';
import gateio from '../src/03-domain/services/adapters/gateio.js';
import WebSocketConnectionService from '../src/03-domain/services/webSocketConnectionService.js';
import { pair, ticker, createFakeSocket, flush } from './fixtures.js';
import { TIMING } from '../src/config.js';

const message = () => ({ channel: 'spot.order_book', event: 'update',
    result: { s: 'ETH_USDT', bids: [['99', '0.5']], asks: [['100', '0.75']] } });

test('Gate.io descubre pares tradable y excluye restricciones y premarket', async () => {
    const instrument = { id: 'ETH_USDT', base: 'ETH', quote: 'USDT', trade_status: 'tradable', type: 'normal' };
    const result = await gateio.discover({ pairsUrl: 'metadata' }, async url => {
        assert.equal(url, 'metadata');
        return [instrument, ...['untradable', 'buyable', 'sellable'].map(trade_status => ({ ...instrument, trade_status })),
            { ...instrument, type: 'premarket' }];
    });
    assert.deepEqual(result, [pair('ETHUSDT', 'ETH', 'ETH_USDT')]);
    await assert.rejects(gateio.discover({}, async () => ({ label: 'ERROR', message: 'Unavailable' })), /Unavailable/);
});

test('Gate.io suscribe order_book y normaliza niveles sin tratar confirmaciones como precios', t => {
    t.mock.timers.enable({ apis: ['Date'], now: 100000 });
    const pairs = [pair('ETHUSDT', 'ETH', 'ETH_USDT')];
    assert.deepEqual(gateio.subscriptions(pairs), [{ time: 100, channel: 'spot.order_book', event: 'subscribe', payload: ['ETH_USDT', '20', '100ms'] }]);
    const parse = gateio.createParser(pairs);
    assert.deepEqual(parse(message()), [ticker({ bidQty: 0.5, askQty: 0.75 })]);
    assert.deepEqual(parse({ channel: 'spot.order_book', event: 'subscribe', error: null, result: { status: 'success' } }), []);
    assert.deepEqual(parse({ channel: 'spot.pong', result: null }), []);
    assert.deepEqual(parse({ ...message(), result: { ...message().result, s: 'UNKNOWN' } }), []);
    assert.throws(() => parse({ error: { code: 2, message: 'Invalid argument' } }), /Invalid argument/);
    assert.deepEqual(gateio.heartbeat(), { time: 100, channel: 'spot.ping' });
});

test('Gate.io entrega cotizaciones y mantiene la conexión mediante spot.ping y spot.pong', async t => {
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 100000 });
    const Socket = createFakeSocket();
    const quotes = [];
    const connection = new WebSocketConnectionService({ exchangeName: 'gateio',
        config: { websocketUrl: 'gateio', adapter: gateio }, pairs: [pair('ETHUSDT', 'ETH', 'ETH_USDT')],
        WebSocketImpl: Socket, onState() {}, onDisconnect() {}, onTickers: tickers => quotes.push(...tickers) });
    t.after(() => connection.stop());
    connection.start();
    t.mock.timers.tick(0);
    await flush();
    const socket = Socket.instances[0];
    socket.message(message());
    for (let index = 0; index < 3; index++) {
        t.mock.timers.tick(TIMING.heartbeatInterval);
        socket.message({ channel: 'spot.pong', result: null });
    }
    assert.equal(socket.sent.filter(message => message.channel === 'spot.ping').length, 3);
    assert.equal(connection.connected, true);
    assert.equal(quotes.length, 1);
    assert.equal(quotes[0].askPrice, 100);
});
