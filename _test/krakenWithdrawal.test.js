import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import kraken from '../src/03-domain/services/adapters/kraken.js';

const credentials = { apiKey: 'test-key', apiSecret: 'dGVzdC1zZWNyZXQ=' };

test('Kraken firma Funding sin permisos de retirada y normaliza los activos de ambas fuentes', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: 1700000000000 });
    const statuses = await kraken.getTransferStatuses(async (url, options) => {
        if (url.includes('/methods/deposit'))
            return { methods: [{ asset: { class: 'currency', name: 'BTC' } }, { asset: { class: 'currency', name: 'LIGHTER' } }, { asset: { class: 'currency', name: 'DEPOSIT' } }] };

        if (url.includes('/funding/')) {
            assert.equal(url, 'https://api.kraken.com/funding/v1/methods/withdraw?limit=10000');
            assert.deepEqual(options.headers, { 'API-Key': 'test-key', 'API-Nonce': '1700000000000000',
                'API-Sign': createHmac('sha512', Buffer.from(credentials.apiSecret, 'base64'))
                    .update('/funding/v1/methods/withdraw?limit=10000')
                    .update(createHash('sha256').update('1700000000000000').digest()).digest('base64') });
            return { methods: [{ asset: { class: 'currency', name: 'BTC' } }, { asset: { class: 'currency', name: 'LUNA' } }, { asset: { class: 'currency', name: 'LIGHTER' } }, { asset: { class: 'currency', name: 'PAUSED' } }, { asset: { class: 'currency', name: 'DEPOSIT' } }] };
        }
        assert.equal(url, 'https://api.kraken.com/0/public/Assets');
        return { error: [], result: {
            XXBT: { altname: 'XBT', status: 'enabled' }, LUNA: { altname: 'LUNA', status: 'withdrawal_only' },
            LIGHTER: { altname: 'LIGHTER', status: 'enabled' },
            PAUSED: { altname: 'PAUSED', status: 'funding_temporarily_disabled' },
            DEPOSIT: { altname: 'DEPOSIT', status: 'deposit_only' },
            MISSING: { altname: 'MISSING', status: 'enabled' }, UNKNOWN: { altname: 'UNKNOWN', status: 'future_status' }
        } };
    }, credentials);
    assert.deepEqual(statuses, [{ asset: 'BTC', withdraw: true, deposit: true }, { asset: 'LUNC', withdraw: true, deposit: false },
        { asset: 'LIT', withdraw: true, deposit: true }, { asset: 'PAUSED', withdraw: false, deposit: false }, { asset: 'DEPOSIT', withdraw: false, deposit: true },
        { asset: 'MISSING', withdraw: false, deposit: false }, { asset: 'UNKNOWN', withdraw: null, deposit: null }]);
});

test('Kraken genera nonces crecientes aunque el reloj no avance', async t => {
    t.mock.timers.enable({ apis: ['Date'], now: 1700000000000 });
    const nonces = [];
    const request = async (url, options) => {
        if (options) { nonces.push(BigInt(options.headers['API-Nonce'])); return { methods: [] }; }
        return { error: [], result: {} };
    };
    await kraken.getTransferStatuses(request, credentials);
    await kraken.getTransferStatuses(request, credentials);
    assert.equal(nonces.length, 4);
    assert.ok(nonces.slice(1).every((nonce, index) => nonce > nonces[index]));
});

test('Kraken sin credenciales no consulta y respuestas fallidas no se convierten en bloqueos', async () => {
    assert.deepEqual(await kraken.getTransferStatuses(() => assert.fail('Unexpected request')), []);
    await assert.rejects(kraken.getTransferStatuses(async () => ({ error: ['Denied'] }), credentials), /funding assets request failed/);
    await assert.rejects(kraken.getTransferStatuses(async url => url.includes('/funding/')
        ? { methods: [] } : { error: ['Unavailable'] }, credentials), /asset status request failed/);
});
