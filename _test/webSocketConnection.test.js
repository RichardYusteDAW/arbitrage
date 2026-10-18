import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocketConnection } from '../services/webSocketConnection.js';
import { TIMING } from '../data/settings.js';
import { createFakeSocket, pair, ticker, flush } from './fixtures.js';

const setup = async (t, { subscriptionError = false } = {}) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 100000 });
    const Socket = createFakeSocket();
    if (subscriptionError) Socket.prototype.send = () => { throw new Error('Send failed'); };
    const states = [];
    let disconnected = 0;
    let updates = [];
    const connection = new WebSocketConnection({ exchangeName: 'one', pairs: [pair()], WebSocketImpl: Socket,
        config: { websocketUrl: 'one', adapter: {
            createParser: () => message => [message],
            subscriptions: () => [{ subscribe: 'ETHUSDT' }],
            heartbeat: () => ({ ping: true })
        } },
        onState: (state, error) => states.push({ state, error }),
        onDisconnect: () => { disconnected++; },
        onTickers: tickers => { updates = tickers; }
    });
    t.after(() => connection.stop());
    connection.start();
    t.mock.timers.tick(0);
    await flush();
    return { connection, Socket, states, disconnected: () => disconnected, updates: () => updates };
};

test('la conexión entrega mensajes, expone su estado y detiene todos los temporizadores', async t => {
    const { connection, Socket, updates } = await setup(t);
    assert.equal(connection.connected, true);
    const socket = Socket.instances[0];
    assert.deepEqual(socket.sent, [{ subscribe: 'ETHUSDT' }]);
    socket.message(ticker());
    assert.equal(updates()[0].askPrice, 100);
    connection.stop();
    socket.message(ticker({ askPrice: 200 }));
    t.mock.timers.tick(100000);
    assert.equal(updates()[0].askPrice, 100);
    assert.equal(connection.connected, false);
    assert.equal(Socket.instances.length, 1);
});

test('un fallo al suscribir produce una sola desconexión y programa el reintento', async t => {
    const { connection, Socket, states, disconnected } = await setup(t, { subscriptionError: true });
    assert.equal(connection.connected, false);
    assert.equal(disconnected(), 1);
    assert.match(states.at(-1).error, /Send failed/);
    t.mock.timers.tick(TIMING.reconnectDelay);
    await flush();
    assert.equal(Socket.instances.length, 2);
    assert.equal(disconnected(), 2);
});

test('un fallo al enviar heartbeat cierra la conexión y elimina su cotización', async t => {
    const { connection, Socket, disconnected } = await setup(t);
    Socket.instances[0].send = () => { throw new Error('Heartbeat failed'); };
    t.mock.timers.tick(TIMING.heartbeatInterval);
    assert.equal(connection.connected, false);
    assert.match(connection.error, /Heartbeat failed/);
    assert.equal(disconnected(), 1);
});

test('error y close del mismo socket no duplican la reconexión', async t => {
    const { Socket, disconnected } = await setup(t);
    Socket.instances[0].dispatchEvent(new Event('error'));
    assert.equal(disconnected(), 1);
    t.mock.timers.tick(TIMING.reconnectDelay);
    await flush();
    assert.equal(Socket.instances.length, 2);
});
