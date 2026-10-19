import test from 'node:test';
import assert from 'node:assert/strict';
import bitstamp from '../src/03-domain/services/adapters/bitstamp.js';
import bitvavo from '../src/03-domain/services/adapters/bitvavo.js';
import cryptocom from '../src/03-domain/services/adapters/cryptocom.js';
import gemini from '../src/03-domain/services/adapters/gemini.js';
import bitfinex from '../src/03-domain/services/adapters/bitfinex.js';
import WebSocketConnectionService from '../src/03-domain/services/webSocketConnectionService.js';
import { EXCHANGES } from '../src/config.js';
import { pair, createFakeSocket, flush } from './fixtures.js';

test('Bitstamp solo descubre spot habilitado y utiliza snapshots completos del libro', async () => {
    const market = { market_symbol: 'ethusd', market_type: 'SPOT', trading: 'Enabled', base_currency: 'ETH', counter_currency: 'USD' };
    const pairs = await bitstamp.discover(EXCHANGES.bitstamp, async () => [market,
        { ...market, market_type: 'PERPETUAL' }, { ...market, trading: 'Disabled' }]);
    assert.deepEqual(pairs, [pair('ETHUSD', 'ETH', 'ethusd')]);
    assert.deepEqual(bitstamp.subscriptions(pairs), [{ event: 'bts:subscribe', data: { channel: 'order_book_ethusd' } }]);
    const parse = bitstamp.createParser(pairs);
    assert.deepEqual(parse({ event: 'bts:subscription_succeeded' }), []);
    const result = parse({ event: 'data', channel: 'order_book_ethusd',
        data: { bids: [['100', '2'], ['99', '50']], asks: [['101', '3'], ['102', '50']] } })[0];
    assert.equal(result.bidPrice, 100);
    assert.equal(result.bidQty, 2);
    assert.equal(result.askQty, 3);
    assert.equal(parse({ event: 'data', channel: 'order_book_ethusd', data: { bids: [], asks: [] } })[0].bidPrice, 0);
    assert.throws(() => parse({ event: 'bts:request_reconnect' }), /reconnect/);
    assert.throws(() => parse({ event: 'bts:error', data: { message: 'Denied' } }), /Denied/);
    await assert.rejects(bitstamp.discover({}, async () => ({})), /discovery/);
});

test('Bitstamp distingue redes habilitadas, bloqueo global y datos desconocidos', async () => {
    const statuses = await bitstamp.getTransferStatuses(async () => [
        { currency: 'ETH', type: 'crypto', networks: [{ withdrawal: 'Enabled', deposit: 'Disabled' }, { withdrawal: 'Disabled', deposit: 'Enabled' }] },
        { currency: 'BTC', type: 'crypto', deposit: 'Disabled', networks: [{ withdrawal: 'Enabled', deposit: 'Enabled' }] },
        { currency: 'UNKNOWN', type: 'crypto' }, { currency: 'USD', type: 'fiat' }
    ]);
    assert.deepEqual(statuses, [{ asset: 'ETH', withdraw: true, deposit: true },
        { asset: 'BTC', withdraw: true, deposit: false }, { asset: 'UNKNOWN', withdraw: null, deposit: null }]);
    await assert.rejects(bitstamp.getTransferStatuses(async () => ({})), /currencies/);
});

test('Bitvavo usa snapshots completos de ticker24h y cantidades del mejor precio', async () => {
    const market = { market: 'ETH-EUR', status: 'trading', base: 'ETH', quote: 'EUR' };
    const pairs = await bitvavo.discover(EXCHANGES.bitvavo, async () => [market, { ...market, status: 'halted' }]);
    assert.deepEqual(pairs, [pair('ETHEUR', 'ETH', 'ETH-EUR')]);
    assert.equal(bitvavo.subscriptions(pairs)[0].channels[0].name, 'ticker24h');
    const parse = bitvavo.createParser(pairs);
    assert.deepEqual(parse({ event: 'subscribed' }), []);
    const result = parse({ event: 'ticker24h', data: [{ market: 'ETH-EUR', bid: '100', bidSize: '2', ask: '101', askSize: '3', volume: '10000' }] })[0];
    assert.equal(result.bidQty, 2);
    assert.equal(result.askQty, 3);
    assert.equal(parse({ event: 'ticker24h', data: { market: 'ETH-EUR', bid: '100', bidSize: '2', ask: '101', askSize: '3' } })[0].askQty, 3);
    assert.equal(parse({ event: 'ticker24h', data: [{ market: 'BTC-EUR' }] }).length, 0);
    assert.throws(() => parse({ errorCode: 1, error: 'Denied' }), /Denied/);
    assert.deepEqual(bitvavo.heartbeat(), { action: 'getTime' });
    await assert.rejects(bitvavo.discover({}, async () => ({})), /discovery/);
});

test('Bitvavo no convierte estados nuevos o ausentes en disponibilidad conocida', async () => {
    const statuses = await bitvavo.getTransferStatuses(async () => [
        { symbol: 'ETH', withdrawalStatus: 'OK', depositStatus: 'MAINTENANCE' },
        { symbol: 'BTC', withdrawalStatus: 'DELISTED', depositStatus: 'OK' }, { symbol: 'NEW', depositStatus: 'FUTURE' }
    ]);
    assert.deepEqual(statuses, [{ asset: 'ETH', withdraw: true, deposit: false },
        { asset: 'BTC', withdraw: false, deposit: true }, { asset: 'NEW', withdraw: null, deposit: null }]);
    await assert.rejects(bitvavo.getTransferStatuses(async () => ({})), /currencies/);
});

test('Crypto.com excluye derivados, valores tokenizados y mercados no negociables', async () => {
    const market = { symbol: 'ETH_USDT', inst_type: 'CCY_PAIR', tradable: true, product_type: 'DIGITAL_CURRENCIES', base_ccy: 'ETH', quote_ccy: 'USDT' };
    const pairs = await cryptocom.discover(EXCHANGES.cryptocom, async () => ({ code: 0, result: { data: [market,
        { ...market, inst_type: 'PERPETUAL_SWAP' }, { ...market, tradable: false }, { ...market, product_type: 'EQUITIES' }] } }));
    assert.deepEqual(pairs, [pair('ETHUSDT', 'ETH', 'ETH_USDT')]);
    assert.deepEqual(cryptocom.subscriptions(pairs)[0].params.channels, ['ticker.ETH_USDT']);
    const parse = cryptocom.createParser(pairs);
    const result = parse({ code: 0, result: { channel: 'ticker', instrument_name: 'ETH_USDT', data: [{ b: '100', bs: '2', k: '101', ks: '3', a: '999' }] } })[0];
    assert.equal(result.askPrice, 101);
    assert.equal(result.bidQty, 2);
    assert.equal(result.askQty, 3);
    assert.deepEqual(parse({ method: 'public/heartbeat', id: 5 }), []);
    assert.deepEqual(cryptocom.respondToMessage({ method: 'public/heartbeat', id: 5 }), { id: 5, method: 'public/respond-heartbeat' });
    assert.throws(() => parse({ code: 40107 }), /subscription/);
    await assert.rejects(cryptocom.discover({}, async () => ({ code: 1 })), /discovery/);
});

test('Gemini separa cotizaciones largas, excluye perpetuals y usa el formato de suscripcion real', async () => {
    const pairs = await gemini.discover(EXCHANGES.gemini, async () => ['ethusdt', 'btcusd', 'ethgusd', 'ethrlusd', 'ethgusdperp', 'gemi-test-up', 'unknown']);
    assert.deepEqual(pairs.map(item => [item.symbol, item.baseAsset]), [['ETHUSDT', 'ETH'], ['BTCUSD', 'BTC'], ['ETHGUSD', 'ETH'], ['ETHRLUSD', 'ETH']]);
    assert.deepEqual(gemini.subscriptions(pairs)[0].params, ['ethusdt@bookTicker', 'btcusd@bookTicker', 'ethgusd@bookTicker', 'ethrlusd@bookTicker']);
    const parse = gemini.createParser(pairs);
    const result = parse({ s: 'ethusdt', b: '100', B: '2', a: '101', A: '3' })[0];
    assert.equal(result.symbol, 'ETHUSDT');
    assert.equal(result.askQty, 3);
    assert.deepEqual(parse({ id: 1, status: 200 }), []);
    assert.throws(() => parse({ status: 400, error: { msg: 'Denied' } }), /Denied/);
    await assert.rejects(gemini.discover({}, async () => ({})), /discovery/);
});

test('Bitfinex aplica el mapa oficial y excluye pares de prueba y valores', async () => {
    const pairs = await bitfinex.discover(EXCHANGES.bitfinex, async () => [
        ['ETHUST', 'DSHUSD', 'WBTUSD', 'WHBT:USD', 'TESTBTC:TESTUSD', 'BTCF0:USTF0', 'SEC:USD'],
        [['UST', 'USDt'], ['DSH', 'DASH'], ['WBT', 'WBTC'], ['WHBT', 'WBT']], ['SEC:USD']
    ]);
    assert.deepEqual(pairs.map(item => [item.id, item.symbol]), [
        ['tETHUST', 'ETHUSDT'], ['tDSHUSD', 'DASHUSD'], ['tWBTUSD', 'WBTCUSD'], ['tWHBT:USD', 'WBTUSD']
    ]);
    assert.equal(bitfinex.subscriptions(pairs)[0].len, '1');
    await assert.rejects(bitfinex.discover({}, async () => ['error', 1, 'Failed']), /discovery/);
});

test('Bitfinex actualiza cada lado, elimina niveles y no conserva precios al reconectar', () => {
    const pairs = [pair('ETHUSDT', 'ETH', 'tETHUST')];
    const parse = bitfinex.createParser(pairs);
    const subscribed = { event: 'subscribed', channel: 'book', symbol: 'tETHUST', chanId: 7 };
    parse(subscribed);
    assert.throws(() => parse([7, [100, 1, 2]]), /before snapshot/);
    const first = parse([7, [[100, 1, 2], [101, 1, -3]]])[0];
    assert.equal(first.bidQty, 2);
    assert.equal(first.askQty, 3);
    assert.equal(parse([7, [102, 1, -4]])[0].askPrice, 102);
    assert.equal(parse([7, [101, 0, -1]])[0].askPrice, 102);
    assert.equal(parse([7, [102, 0, -1]])[0].askQty, 0);
    assert.equal(parse([7, []])[0].bidQty, 0);
    assert.deepEqual(parse([7, 'hb']), []);
    const next = bitfinex.createParser(pairs);
    next(subscribed);
    assert.throws(() => next([7, [100, 1, 2]]), /before snapshot/);
    assert.throws(() => parse({ event: 'info', code: 20060 }), /reconnect/);
    assert.throws(() => parse({ event: 'error', msg: 'Denied' }), /Denied/);
});

test('Bitfinex agrupa metodos de transferencia y conserva desconocidos', async () => {
    const statuses = await bitfinex.getTransferStatuses(async () => [
        [['ETHEREUM', ['ETH', 'UST']], ['TRON', ['UST']], ['OTHER', ['MISSING']]],
        [['ETHEREUM', 0, 1], ['TRON', 1, 0]], [['UST', 'USDt']]
    ]);
    assert.deepEqual(statuses, [{ asset: 'ETH', deposit: false, withdraw: true },
        { asset: 'USDT', deposit: true, withdraw: true }, { asset: 'MISSING', deposit: null, withdraw: null }]);
    await assert.rejects(bitfinex.getTransferStatuses(async () => []), /currencies/);
});

test('Crypto.com responde al heartbeat y cancela suscripciones demoradas al detener', async t => {
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
    const Socket = createFakeSocket();
    const connection = new WebSocketConnectionService({ exchangeName: 'cryptocom', config: EXCHANGES.cryptocom,
        pairs: [pair('ETHUSDT', 'ETH', 'ETH_USDT')], prepareConnection: cryptocom.prepareConnection,
        WebSocketImpl: Socket, onTickers: () => {}, onDisconnect: () => {}, onState: () => {} });
    t.after(() => connection.stop());
    await connection.connect();
    await flush();
    const socket = Socket.instances[0];
    assert.equal(socket.sent.length, 0);
    socket.message({ id: 99, method: 'public/heartbeat', code: 0 });
    assert.deepEqual(socket.sent, [{ id: 99, method: 'public/respond-heartbeat' }]);
    t.mock.timers.tick(1000);
    assert.equal(socket.sent[1].method, 'subscribe');
    connection.stop();
    const before = socket.sent.length;
    t.mock.timers.tick(60000);
    assert.equal(socket.sent.length, before);

    const stopped = new WebSocketConnectionService({ exchangeName: 'cryptocom', config: EXCHANGES.cryptocom,
        pairs: [], prepareConnection: cryptocom.prepareConnection, WebSocketImpl: Socket,
        onTickers: () => {}, onDisconnect: () => {}, onState: () => {} });
    await stopped.connect();
    await flush();
    stopped.stop();
    t.mock.timers.tick(1000);
    assert.deepEqual(Socket.instances[1].sent, []);
});
