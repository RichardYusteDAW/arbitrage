import test from 'node:test';
import assert from 'node:assert/strict';
import bitget from '../src/03-domain/services/adapters/bitget.js';
import WebSocketConnectionService from '../src/03-domain/services/webSocketConnectionService.js';
import { pair, ticker, createFakeSocket, flush } from './fixtures.js';
import { TIMING } from '../src/config.js';

const snapshot = () => ({ arg: { instType: 'spot', topic: 'books5', symbol: 'ETHUSDT' }, action: 'snapshot',
    data: [{ b: [['99', '0.5']], a: [['100', '0.75']] }] });

test('Bitget descubre spot online y propaga errores REST', async () => {
    const instrument = { category: 'SPOT', symbol: 'ETHUSDT', baseCoin: 'ETH', quoteCoin: 'USDT', status: 'online' };
    const result = await bitget.discover({ pairsUrl: 'metadata' }, async url => {
        assert.equal(url, 'metadata');
        return { code: '00000', data: [instrument, { ...instrument, category: 'USDT-FUTURES' },
            { ...instrument, status: 'offline' }, { ...instrument, status: 'halt' }] };
    });
    assert.deepEqual(result, [pair()]);
    await assert.rejects(bitget.discover({}, async () => ({ code: '40000', msg: 'Unavailable' })), /Unavailable/);
});

test('Bitget suscribe books5 v3 y obtiene el símbolo desde arg', () => {
    assert.deepEqual(bitget.subscriptions([pair()]), [{ op: 'subscribe', args: [{ instType: 'spot', topic: 'books5', symbol: 'ETHUSDT' }] }]);
    const parse = bitget.createParser([pair()]);
    assert.deepEqual(parse(snapshot()), [ticker({ bidQty: 0.5, askQty: 0.75 })]);
    assert.deepEqual(parse({ event: 'subscribe', arg: snapshot().arg }), []);
    assert.deepEqual(parse({ ...snapshot(), arg: { ...snapshot().arg, symbol: 'UNKNOWN' } }), []);
    assert.deepEqual(parse({ ...snapshot(), arg: { ...snapshot().arg, instType: 'usdt-futures' } }), []);
    assert.deepEqual(parse({ ...snapshot(), arg: { ...snapshot().arg, topic: 'candle1m' } }), []);
    assert.throws(() => parse({ event: 'error', code: '30001', msg: 'Denied' }), /Denied/);
    assert.equal(bitget.decodeMessage('pong'), null);
    assert.throws(() => bitget.decodeMessage('{bad'), SyntaxError);
});

test('Bitget envía ping sin JSON y procesa pong sin perder las cotizaciones', async t => {
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 100000 });
    const Socket = createFakeSocket();
    const send = Socket.prototype.send;
    const sent = [];
    Socket.prototype.send = function (text) {
        sent.push(text);
        if (text !== 'ping') send.call(this, text);
    };
    let updates = [];
    const connection = new WebSocketConnectionService({ exchangeName: 'bitget',
        config: { websocketUrl: 'bitget', adapter: bitget }, pairs: [pair()], WebSocketImpl: Socket,
        onState() {}, onDisconnect() {}, onTickers: tickers => { updates = tickers; } });
    t.after(() => connection.stop());
    connection.start();
    t.mock.timers.tick(0);
    await flush();
    const socket = Socket.instances[0];
    socket.message(snapshot());
    for (let index = 0; index < 3; index++) {
        t.mock.timers.tick(TIMING.heartbeatInterval);
        socket.raw('pong');
    }
    assert.equal(sent.filter(text => text === 'ping').length, 3);
    assert.equal(connection.connected, true);
    assert.equal(updates[0].askPrice, 100);
    assert.equal(Socket.instances.length, 1);
});
