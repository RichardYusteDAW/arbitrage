import test from 'node:test';
import assert from 'node:assert/strict';
import kucoin from '../src/03-domain/services/adapters/kucoin.js';
import WebSocketConnectionService from '../src/03-domain/services/webSocketConnectionService.js';
import RequestClientService from '../src/03-domain/services/requestClientService.js';
import { pair, ticker, createFakeSocket, flush } from './fixtures.js';

const tokenResponse = token => ({ code: '200000', data: { token, instanceServers: [{
    endpoint: 'wss://example.com/ws', protocol: 'websocket', encrypt: true, pingInterval: 18000, pingTimeout: 10000
}] } });
const message = () => ({ type: 'message', topic: '/market/ticker:ETH-USDT', data: {
    bestBid: '99', bestBidSize: '0.5', bestAsk: '100', bestAskSize: '0.75'
} });

test('KuCoin descubre solo pares habilitados y normaliza los símbolos', async () => {
    const instrument = { symbol: 'ETH-USDT', baseCurrency: 'ETH', quoteCurrency: 'USDT', enableTrading: true };
    assert.deepEqual(await kucoin.discover({}, async () => ({ code: '200000', data: [instrument,
        { ...instrument, enableTrading: false }] })), [pair('ETHUSDT', 'ETH', 'ETH-USDT')]);
    await assert.rejects(kucoin.discover({}, async () => ({ code: '400000', msg: 'Denied' })), /Denied/);
});

test('KuCoin obtiene el token por POST y respeta el servidor y los tiempos recibidos', async () => {
    const client = new RequestClientService({ fetchImpl: async (url, options) => {
        assert.equal(url, 'https://api.kucoin.com/api/v1/bullet-public');
        assert.equal(options.method, 'POST');
        assert.ok(options.signal instanceof AbortSignal);
        return { ok: true, json: async () => tokenResponse('a+b/c=') };
    } });
    const settings = await kucoin.prepareConnection({}, (url, options) => client.request(url, options));
    const url = new URL(settings.websocketUrl);
    assert.equal(url.origin, 'wss://example.com');
    assert.equal(url.searchParams.get('token'), 'a+b/c=');
    assert.ok(url.searchParams.get('connectId'));
    assert.equal(settings.heartbeatInterval, 18000);
    assert.equal(settings.heartbeatTimeout, 10000);
    await assert.rejects(kucoin.prepareConnection({}, async () => ({ code: '400000', msg: 'Token failed' })), /Token failed/);
    await assert.rejects(kucoin.prepareConnection({}, async () => ({ code: '200000', data: { token: 'x', instanceServers: [] } })), /configuration/);
});

test('KuCoin suscribe ticker, normaliza BBO e ignora welcome, ack y pong', () => {
    const pairs = [pair('ETHUSDT', 'ETH', 'ETH-USDT')];
    const subscription = kucoin.subscriptions(pairs)[0];
    assert.equal(subscription.topic, '/market/ticker:ETH-USDT');
    assert.equal(subscription.privateChannel, false);
    assert.equal(subscription.response, true);
    const parse = kucoin.createParser(pairs);
    assert.deepEqual(parse(message()), [ticker({ bidQty: 0.5, askQty: 0.75 })]);
    for (const type of ['welcome', 'ack', 'pong']) assert.deepEqual(parse({ type }), []);
    assert.deepEqual(parse({ ...message(), topic: '/market/ticker:UNKNOWN' }), []);
    assert.throws(() => parse({ type: 'error', data: 'Invalid topic' }), /Invalid topic/);
});

test('KuCoin envía heartbeat, detecta la ausencia de pong y renueva el token al reconectar', async t => {
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 100000 });
    const Socket = createFakeSocket();
    let requests = 0;
    const connection = new WebSocketConnectionService({ exchangeName: 'kucoin', pairs: [pair('ETHUSDT', 'ETH', 'ETH-USDT')],
        config: { adapter: kucoin }, WebSocketImpl: Socket,
        prepareConnection: () => kucoin.prepareConnection({}, async () => tokenResponse('token' + ++requests)),
        onState() {}, onDisconnect() {}, onTickers() {} });
    t.after(() => connection.stop());
    connection.start();
    t.mock.timers.tick(0);
    await flush();
    const first = Socket.instances[0];
    assert.equal(new URL(first.url).searchParams.get('token'), 'token1');
    t.mock.timers.tick(18000);
    assert.equal(first.sent.at(-1).type, 'ping');
    first.message({ type: 'pong' });
    t.mock.timers.tick(10000);
    assert.equal(connection.connected, true);
    t.mock.timers.tick(8000);
    t.mock.timers.tick(10000);
    assert.match(connection.error, /pong timeout/);
    assert.equal(first.closed, true);
    t.mock.timers.tick(1000);
    await flush();
    assert.equal(new URL(Socket.instances[1].url).searchParams.get('token'), 'token2');
});

test('detener durante la obtención del token impide abrir una conexión tardía', async t => {
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
    const Socket = createFakeSocket();
    let resolve;
    const connection = new WebSocketConnectionService({ exchangeName: 'kucoin', pairs: [], config: { adapter: kucoin },
        WebSocketImpl: Socket, prepareConnection: () => new Promise(done => { resolve = done; }),
        onState() {}, onDisconnect() {}, onTickers() {} });
    connection.start();
    t.mock.timers.tick(0);
    connection.stop();
    resolve({ websocketUrl: 'wss://example.com' });
    await flush();
    assert.equal(Socket.instances.length, 0);
});
