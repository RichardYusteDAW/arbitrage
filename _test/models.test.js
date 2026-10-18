import test from 'node:test';
import assert from 'node:assert/strict';
import { TickerData } from '../models/ticker.js';
import { Opportunity } from '../models/opportunity.js';
import { ExchangeConfig, ExchangePair } from '../models/exchange.js';
import EXCHANGES from '../data/exchanges.js';
import { ticker, pair } from './fixtures.js';

test('TickerData conserva los campos y añade receivedAt solo cuando se recibe', () => {
    const original = ticker();
    assert.ok(original instanceof TickerData);
    assert.equal(Object.hasOwn(original, 'receivedAt'), false);
    const received = new TickerData({ ...original, receivedAt: 123 });
    assert.equal(received.receivedAt, 123);
    assert.equal(original.receivedAt, undefined);
    assert.deepEqual({ ...received }, { ...original, receivedAt: 123 });
});

test('Opportunity conserva valores numéricos y null sin formatear ni recalcular', () => {
    const opportunity = new Opportunity({ symbol: 'ETHBTC', buy: 'a', sell: 'b', profitability: 1.234567,
        maxVolumeUSD: null, profitUSD: null });
    assert.equal(opportunity.profitability, 1.234567);
    assert.equal(opportunity.maxVolumeUSD, null);
    assert.equal(opportunity.profitUSD, null);
});

test('ExchangePair distingue el símbolo común del identificador nativo', () => {
    const result = pair('ETHUSDT', 'ETH', 'ETH-USDT');
    assert.ok(result instanceof ExchangePair);
    assert.equal(result.symbol, 'ETHUSDT');
    assert.equal(result.id, 'ETH-USDT');
});

test('toda la configuración utiliza ExchangeConfig y conserva los contratos de adaptador', () => {
    for (const config of Object.values(EXCHANGES)) {
        assert.ok(config instanceof ExchangeConfig);
        assert.equal(new URL(config.websocketUrl).protocol, 'wss:');
        assert.ok(config.maxPairsPerConnection > 0);
        for (const method of ['discover', 'subscriptions', 'createParser']) assert.equal(typeof config.adapter[method], 'function');
    }
});
