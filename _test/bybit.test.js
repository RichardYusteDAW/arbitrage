import test from 'node:test';
import assert from 'node:assert/strict';
import bybit from '../src/03-domain/services/adapters/bybit.js';
import WebSocketConnectionService from '../src/03-domain/services/webSocketConnectionService.js';
import { pair, ticker, createFakeSocket, flush } from './fixtures.js';
import { TIMING } from '../src/config.js';

const snapshot = (changes = {}) => ({ topic: 'orderbook.50.ETHUSDT', type: 'snapshot',
    data: { s: 'ETHUSDT', b: [['99', '0.5']], a: [['100', '0.75']], ...changes } });

test('Bybit descubre solo pares Trading y propaga errores REST', async () => {
    const instrument = { symbol: 'ETHUSDT', baseCoin: 'ETH', quoteCoin: 'USDT', status: 'Trading' };
    const result = await bybit.discover({ pairsUrl: 'metadata' }, async url => {
        assert.equal(url, 'metadata');
        return { retCode: 0, result: { list: [instrument, { ...instrument, status: 'PendingOpen' }, { ...instrument, status: 'Closed' }] } };
    });
    assert.deepEqual(result, [pair()]);
    await assert.rejects(bybit.discover({}, async () => ({ retCode: 10006, retMsg: 'Too many visits' })), /Too many visits/);
});

test('Bybit suscribe todos los pares en mensajes de hasta 10 argumentos', () => {
    const pairs = Array.from({ length: 100 }, (_, index) => pair('TOKEN' + index + 'USDT'));
    const messages = bybit.subscriptions(pairs);
    assert.equal(messages.length, 10);
    assert.ok(messages.every(message => message.op === 'subscribe' && message.args.length === 10));
    assert.deepEqual(messages.flatMap(message => message.args), pairs.map(pair => 'orderbook.50.' + pair.id));
    assert.deepEqual(bybit.subscriptions(pairs.slice(0, 11)).map(message => message.args.length), [10, 1]);
    assert.deepEqual(bybit.subscriptions([]), []);
});

test('Bybit normaliza snapshots, reemplaza lados vacíos e ignora confirmaciones y pong', () => {
    const parse = bybit.createParser([pair()]);
    assert.deepEqual(parse(snapshot()), [ticker({ bidQty: 0.5, askQty: 0.75 })]);
    assert.deepEqual(parse(snapshot({ b: [], a: [] })), [ticker({ bids: [], asks: [] })]);
    assert.deepEqual(parse(snapshot({ s: 'UNKNOWN' })), []);
    assert.deepEqual(parse({ op: 'subscribe', success: true }), []);
    assert.deepEqual(parse({ op: 'ping', success: true, ret_msg: 'pong' }), []);
    assert.deepEqual(parse({ topic: 'orderbook.1.ETHUSDT' }), []);
    assert.throws(() => parse({ op: 'subscribe', success: false, ret_msg: 'Denied' }), /Denied/);
    assert.throws(() => bybit.createParser([pair()])({ ...snapshot(), type: 'delta' }), /snapshot/);
});

test('Bybit mantiene la conexión con ping y pong y entrega snapshots', async t => {
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 100000 });
    const Socket = createFakeSocket();
    const quotes = [];
    const connection = new WebSocketConnectionService({ exchangeName: 'bybit',
        config: { websocketUrl: 'bybit', adapter: bybit }, pairs: [pair()], WebSocketImpl: Socket,
        onState() {}, onDisconnect() {}, onTickers: tickers => quotes.push(...tickers) });
    t.after(() => connection.stop());
    connection.start();
    t.mock.timers.tick(0);
    await flush();
    const socket = Socket.instances[0];
    socket.message(snapshot());
    for (let index = 0; index < 3; index++) {
        t.mock.timers.tick(TIMING.heartbeatInterval);
        socket.message({ success: true, ret_msg: 'pong', op: 'ping' });
    }
    assert.equal(socket.sent.filter(message => message.op === 'ping').length, 3);
    assert.equal(connection.connected, true);
    assert.equal(quotes.length, 1);
    assert.equal(quotes[0].askPrice, 100);
});
