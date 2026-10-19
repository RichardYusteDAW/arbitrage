import test from 'node:test';
import assert from 'node:assert/strict';
import normalizeAssets from '../src/01-common/normalizeAssets.js';
import kraken from '../src/03-domain/services/adapters/kraken.js';
import okx from '../src/03-domain/services/adapters/okx.js';
import { pair } from './fixtures.js';
import PairSelectionService from '../src/03-domain/services/pairSelectionService.js';

test('las excepciones se aplican una sola vez y solo al exchange indicado', () => {
    assert.deepEqual(normalizeAssets('kraken', 'LUNA', 'EUR'), { symbol: 'LUNCEUR', baseAsset: 'LUNC' });
    assert.deepEqual(normalizeAssets('kraken', 'LUNA2', 'EUR'), { symbol: 'LUNAEUR', baseAsset: 'LUNA' });
    assert.deepEqual(normalizeAssets('okx', 'LUNA', 'EUR'), { symbol: 'LUNAEUR', baseAsset: 'LUNA' });
    assert.deepEqual(normalizeAssets('kraken', 'ETH', 'XBT'), { symbol: 'ETHBTC', baseAsset: 'ETH' });
    assert.deepEqual(normalizeAssets('unknown', 'ETH', 'USD'), { symbol: 'ETHUSD', baseAsset: 'ETH' });
    assert.equal(normalizeAssets('okx', 'XTER', 'USDT'), null);
    assert.equal(normalizeAssets('okx', 'ETH', 'XTER'), null);
    assert.deepEqual(normalizeAssets('bitget', 'XTER', 'USDT'), { symbol: 'XTERUSDT', baseAsset: 'XTER' });
});

test('Kraken distingue las dos Terra conservando los identificadores de suscripción y de mensajes', async () => {
    const pairs = await kraken.discover({}, async () => ({ error: [], result: {
        classic: { status: 'online', wsname: 'LUNA/EUR' }, terra: { status: 'online', wsname: 'LUNA2/EUR' }
    } }));
    assert.deepEqual(pairs, [pair('LUNCEUR', 'LUNC', 'LUNA/EUR'), pair('LUNAEUR', 'LUNA', 'LUNA2/EUR')]);
    assert.deepEqual(kraken.subscriptions(pairs)[0].params.symbol, ['LUNA/EUR', 'LUNA2/EUR']);
    const quotes = kraken.createParser(pairs)({ channel: 'book', type: 'snapshot', data: [
        { symbol: 'LUNA/EUR', bids: [{ price: 0.00004, qty: 1000 }], asks: [{ price: 0.00005, qty: 1000 }] },
        { symbol: 'LUNA2/EUR', bids: [{ price: 0.04, qty: 10 }], asks: [{ price: 0.05, qty: 10 }] }
    ] });
    assert.deepEqual(quotes.map(quote => [quote.symbol, quote.baseAsset]), [['LUNCEUR', 'LUNC'], ['LUNAEUR', 'LUNA']]);
    const selected = new PairSelectionService().selectPairs({ kraken: pairs, okx: [pair('LUNAEUR', 'LUNA', 'LUNA-EUR')] });
    assert.deepEqual(selected.kraken.map(pair => pair.id), ['LUNA2/EUR']);
});

test('OKX aplica la exclusión XTER del catálogo incluso si no recibe la categoría de acción tokenizada', async () => {
    const pairs = await okx.discover({}, async () => ({ code: '0', data: [
        { instType: 'SPOT', state: 'live', instId: 'XTER-USDT', baseCcy: 'XTER', quoteCcy: 'USDT' },
        { instType: 'SPOT', state: 'live', instId: 'ETH-USDT', baseCcy: 'ETH', quoteCcy: 'USDT' }
    ] }));
    assert.deepEqual(pairs, [pair('ETHUSDT', 'ETH', 'ETH-USDT')]);
});
