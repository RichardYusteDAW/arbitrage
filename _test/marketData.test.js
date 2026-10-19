import StartMarketDataUseCase from '../src/03-domain/usecases/StartMarketDataUseCase.js';
import StopMarketDataUseCase from '../src/03-domain/usecases/StopMarketDataUseCase.js';
import GetMarketStatusUseCase from '../src/03-domain/usecases/GetMarketStatusUseCase.js';
import RequestClientService from '../src/03-domain/services/requestClientService.js';
import QuoteStoreService from '../src/03-domain/services/quoteStoreService.js';
import WebSocketConnectionService from '../src/03-domain/services/webSocketConnectionService.js';
import { TIMING } from '../src/config.js';
import PairSelectionService from '../src/03-domain/services/pairSelectionService.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import PairDiscoveryService from '../src/03-domain/services/pairDiscoveryService.js';
import ConnectionService from '../src/03-domain/services/connectionService.js';
import { calculateOpportunities } from '../src/03-domain/helpers/calculations.js';
import { createFakeSocket, flush, pair, ticker } from './fixtures.js';

const setup = async (t, options = {}) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 100000 });
    const Socket = createFakeSocket({ autoOpen: options.autoOpen ?? true });
    let parserCount = 0;
    const adapter = {
        discover: async (config, request) => (await request(config.pairsUrl)).pairs,
        subscriptions: pairs => [{ type: 'subscribe', symbols: pairs.map(value => value.symbol) }],
        heartbeat: () => ({ type: 'ping' }),
        createParser: () => { parserCount++; return message => {
            if (message.error) throw new Error(message.error);
            return [message];
        }; }
    };
    const config = name => ({ websocketUrl: name, pairsUrl: name, maxPairsPerConnection: options.maxPairs ?? 100, adapter });
    const pairDiscovery = new PairDiscoveryService({ one: config('one'), two: config('two') });
    const connections = new ConnectionService(pairDiscovery.getExchangeNames());
    const quoteStore = new QuoteStoreService(pairDiscovery.getExchangeNames(), 30000);
    const requestClient = new RequestClientService({
        fetchImpl: options.fetchImpl ?? (async () => ({ ok: true, json: async () => ({ pairs: options.pairs ?? [pair()] }) }))
    });
    const startUseCase = new StartMarketDataUseCase({
        pairDiscovery, connections, quoteStore, requestClient, pairSelection: new PairSelectionService(),
        createConnection: options => new WebSocketConnectionService(options),
        WebSocketImpl: Socket, reconnectDelay: 1000, timing: TIMING
    });
    const stopUseCase = new StopMarketDataUseCase(pairDiscovery, connections, requestClient, quoteStore);
    const statusUseCase = new GetMarketStatusUseCase(pairDiscovery, connections, quoteStore);
    const service = {
        start: () => startUseCase.execute(),
        stop: () => stopUseCase.execute(),
        getData: () => quoteStore.getData(),
        getStatus: () => statusUseCase.execute()
    };
    t.after(() => service.stop());
    service.start();
    await flush();
    t.mock.timers.tick(0);
    await flush();
    return { service, Socket, parserCount: () => parserCount,
        socket: name => Socket.instances.findLast(socket => socket.url === name && !socket.closed) };
};

test('selecciona pares compartidos y conversiones, sin contar duplicados de un solo exchange', () => {
    const catalogs = { one: [pair('ETHBTC'), pair(), pair('ETHUSDC'), pair('ETHUSD'), pair('OTHERBTC', 'OTHER'), pair('DUP', 'DUP'), pair('DUP', 'DUP')],
        two: [pair('ETHBTC')] };
    const selected = new PairSelectionService().selectPairs(catalogs);
    assert.deepEqual(selected.one.map(value => value.symbol), ['ETHBTC', 'ETHUSDT', 'ETHUSDC', 'ETHUSD']);
    assert.deepEqual(selected.two.map(value => value.symbol), ['ETHBTC']);
    assert.deepEqual(new PairSelectionService().selectPairs({}), {});
});

test('inicia una sola vez, suscribe cada conexión y produce oportunidades con fecha de recepción', async t => {
    const { service, Socket, socket } = await setup(t);
    const count = Socket.instances.length;
    service.start();
    await flush();
    assert.equal(Socket.instances.length, count);
    assert.deepEqual(socket('one').sent, [{ type: 'subscribe', symbols: ['ETHUSDT'] }]);
    socket('one').message(ticker());
    socket('two').message(ticker({ askPrice: 103, bidPrice: 102 }));
    assert.equal(service.getData().one[0].receivedAt, 100000);
    assert.equal(service.getStatus().two.quotes, 1);
    assert.equal(calculateOpportunities(service.getData())[0].profitUSD, 2);
});

test('desconectar retira datos y reconectar crea un parser nuevo sin reutilizar cotizaciones', async t => {
    const { service, Socket, socket, parserCount } = await setup(t);
    socket('one').message(ticker());
    socket('two').message(ticker({ bidPrice: 102, askPrice: 103 }));
    const oldSocket = socket('two');
    const count = parserCount();
    oldSocket.close();
    assert.deepEqual(service.getData().two, []);
    assert.deepEqual(calculateOpportunities(service.getData()), []);
    const total = Socket.instances.length;
    t.mock.timers.tick(999);
    assert.equal(Socket.instances.length, total);
    t.mock.timers.tick(1);
    await flush();
    assert.equal(parserCount(), count + 1);
    oldSocket.message(ticker({ bidPrice: 500 }));
    assert.deepEqual(service.getData().two, []);
    socket('two').message(ticker({ bidPrice: 103, askPrice: 104 }));
    assert.equal(calculateOpportunities(service.getData())[0].profitUSD, 3);
});

test('reconexiones consecutivas usan una espera creciente', async t => {
    const { Socket, socket } = await setup(t);
    socket('two').close();
    t.mock.timers.tick(1000);
    await flush();
    socket('two').close();
    const count = Socket.instances.length;
    t.mock.timers.tick(1999);
    assert.equal(Socket.instances.length, count);
    t.mock.timers.tick(1);
    await flush();
    assert.equal(Socket.instances.length, count + 1);
});

test('rechaza cotizaciones con precios o cantidades inválidos y retira la anterior', async t => {
    const { service, socket } = await setup(t);
    for (const field of ['askPrice', 'bidPrice', 'askQty', 'bidQty']) {
        for (const invalid of [0, -1, null, 'invalid']) {
            socket('one').message(ticker());
            assert.equal(service.getData().one.length, 1);
            socket('one').message(ticker({ [field]: invalid }));
            assert.equal(service.getData().one.length, 0);
        }
    }
});

test('retira cotizaciones caducadas del cálculo y del contador', async t => {
    const { service, socket } = await setup(t);
    socket('one').message(ticker());
    t.mock.timers.tick(30001);
    assert.deepEqual(service.getData().one, []);
    assert.equal(service.getStatus().one.quotes, 0);
});

test('JSON incorrecto y errores del parser provocan reconexión', async t => {
    const { service, socket } = await setup(t);
    socket('one').message(ticker());
    socket('one').raw('{invalid');
    assert.equal(service.getStatus().one.state, 'reconectando');
    assert.deepEqual(service.getData().one, []);
    socket('two').message({ error: 'Snapshot required' });
    assert.match(service.getStatus().two.error, /Snapshot required/);
});

test('envía heartbeats y reconecta una conexión sin mensajes', async t => {
    const { service, socket } = await setup(t);
    const connection = socket('one');
    t.mock.timers.tick(20000);
    assert.ok(connection.sent.some(message => message.type === 'ping'));
    t.mock.timers.tick(40000);
    assert.equal(connection.closed, true);
    assert.match(service.getStatus().one.error, /45 seconds/);
});

test('una conexión que no abre termina por timeout', async t => {
    const { service, Socket } = await setup(t, { autoOpen: false });
    t.mock.timers.tick(15000);
    assert.equal(Socket.instances.every(socket => socket.closed), true);
    assert.match(service.getStatus().one.error, /Connection timeout/);
});

test('reparte las suscripciones en conexiones y permite estado parcial', async t => {
    const { service, socket } = await setup(t, { pairs: [pair(), pair('BTCUSDT', 'BTC')], maxPairs: 1 });
    assert.equal(service.getStatus().one.connections, 1);
    assert.equal(service.getStatus().one.totalConnections, 2);
    assert.equal(service.getStatus().one.state, 'conexion parcial');
    t.mock.timers.tick(500);
    await flush();
    assert.equal(service.getStatus().one.connections, 2);
    assert.equal(socket('one').sent[0].symbols.length, 1);
});

test('un fallo de metadatos se muestra y se reintenta sin impedir la recuperación', async t => {
    let attempts = 0;
    const { service } = await setup(t, { fetchImpl: async url => {
        if (url === 'two' && ++attempts === 1) return { ok: false, status: 503 };
        return { ok: true, json: async () => ({ pairs: [pair()] }) };
    } });
    assert.match(service.getStatus().two.error, /503/);
    t.mock.timers.tick(10000);
    await flush();
    t.mock.timers.tick(0);
    await flush();
    assert.equal(attempts, 2);
    assert.equal(service.getStatus().two.connections, 1);
});

test('detener cancela reconexiones, cierra sockets y elimina datos', async t => {
    const { service, Socket, socket } = await setup(t);
    socket('one').message(ticker());
    socket('two').close();
    const count = Socket.instances.length;
    service.stop();
    t.mock.timers.tick(100000);
    await flush();
    assert.equal(Socket.instances.length, count);
    assert.ok(Socket.instances.every(socket => socket.closed));
    assert.deepEqual(service.getData(), { one: [], two: [] });
});

test('detener aborta peticiones REST pendientes y evita reintentos', async t => {
    let aborted = 0;
    const { service } = await setup(t, { fetchImpl: (url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => { aborted++; reject(new Error('Aborted')); });
    }) });
    service.stop();
    await flush();
    t.mock.timers.tick(100000);
    assert.equal(aborted, 2);
});
