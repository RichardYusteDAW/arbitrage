import test from 'node:test';
import assert from 'node:assert/strict';
import okx from '../src/03-domain/services/adapters/okx.js';
import WebSocketConnectionService from '../src/03-domain/services/webSocketConnectionService.js';
import { pair, ticker, createFakeSocket, flush } from './fixtures.js';
import { TIMING } from '../src/config.js';

test('OKX descubre spot activos, normaliza símbolos y rechaza errores REST', async () => {
    const instrument = { instType: 'SPOT', state: 'live', instId: 'ETH-USDT', baseCcy: 'ETH', quoteCcy: 'USDT' };
    const result = await okx.discover({ pairsUrl: 'metadata' }, async url => {
        assert.equal(url, 'metadata');
        return { code: '0', data: [instrument, { ...instrument, state: 'suspend' },
            { ...instrument, state: 'preopen' }, { ...instrument, instType: 'SWAP' }] };
    });
    assert.deepEqual(result, [pair('ETHUSDT', 'ETH', 'ETH-USDT')]);
    await assert.rejects(okx.discover({}, async () => ({ code: '50000', msg: 'Unavailable' })), /Unavailable/);
});

test('OKX suscribe books5, normaliza niveles y propaga errores de suscripción', () => {
    const pairs = [pair('ETHUSDT', 'ETH', 'ETH-USDT')];
    assert.deepEqual(okx.subscriptions(pairs), [{ op: 'subscribe', args: [{ channel: 'books5', instId: 'ETH-USDT' }] }]);
    const parse = okx.createParser(pairs);
    assert.deepEqual(parse({ event: 'subscribe', arg: { channel: 'books5' } }), []);
    assert.deepEqual(parse({ arg: { channel: 'books5' }, data: [
        { instId: 'ETH-USDT', bids: [['99', '0.5']], asks: [['100', '0.75']] }, { instId: 'UNKNOWN' }
    ] }), [ticker({ bidQty: 0.5, askQty: 0.75 })]);
    assert.throws(() => parse({ event: 'error', code: '60012', msg: 'Invalid subscription' }), /Invalid subscription/);
    assert.throws(() => okx.decodeMessage('{bad'), SyntaxError);
});

test('OKX envía ping como texto, procesa pong y conserva las cotizaciones', async t => {
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 100000 });
    const Socket = createFakeSocket();
    const send = Socket.prototype.send;
    const sent = [];
    Socket.prototype.send = function (text) {
        sent.push(text);
        if (text !== 'ping') send.call(this, text);
    };
    let updates = [];
    const connection = new WebSocketConnectionService({ exchangeName: 'okx',
        config: { websocketUrl: 'okx', adapter: okx }, pairs: [pair('ETHUSDT', 'ETH', 'ETH-USDT')],
        WebSocketImpl: Socket, onState() {}, onDisconnect() {}, onTickers: values => { updates = values; } });
    t.after(() => connection.stop());
    connection.start();
    t.mock.timers.tick(0);
    await flush();
    const socket = Socket.instances[0];
    socket.message({ arg: { channel: 'books5' }, data: [{ instId: 'ETH-USDT', bids: [['99', '1']], asks: [['100', '2']] }] });
    for (let index = 0; index < 3; index++) {
        t.mock.timers.tick(TIMING.heartbeatInterval);
        socket.raw('pong');
    }
    assert.equal(sent.filter(value => value === 'ping').length, 3);
    assert.equal(connection.connected, true);
    assert.equal(updates[0].askPrice, 100);
    assert.equal(Socket.instances.length, 1);
});


test('OKX excluye acciones tokenizadas aunque compartan s?mbolo con una criptomoneda', async () => {
    const discovered = await okx.discover({}, async () => ({ code: '0', data: [
        { instType: 'SPOT', state: 'live', instCategory: '3', instId: 'XTER-USDT', baseCcy: 'XTER', quoteCcy: 'USDT' },
        { instType: 'SPOT', state: 'live', instCategory: '1', instId: 'ETH-USDT', baseCcy: 'ETH', quoteCcy: 'USDT' }
    ] }));
    assert.deepEqual(discovered, [pair('ETHUSDT', 'ETH', 'ETH-USDT')]);
    const parse = okx.createParser(discovered);
    assert.deepEqual(parse({ arg: { channel: 'books5' }, data: [
        { instId: 'XTER-USDT', bids: [['337', '3']], asks: [['338', '3']] }
    ] }), []);
});
