import test from 'node:test';
import assert from 'node:assert/strict';
import okx from '../src/03-domain/services/adapters/okx.js';

const credentials = { apiKey: 'test-key', apiSecret: 'test-secret', passphrase: 'test-passphrase' };

test('OKX firma con hora ISO y agrupa la disponibilidad por moneda entre redes', async () => {
    const statuses = await okx.getTransferStatuses(async (url, options) => {
        if (url.endsWith('/public/time'))
            return { code: '0', data: [{ ts: '1700000000000' }] };

        assert.equal(url, 'https://www.okx.com/api/v5/asset/currencies');
        assert.deepEqual(options.headers, {
            'OK-ACCESS-KEY': 'test-key',
            'OK-ACCESS-SIGN': '/OzwRKaKji+BHWbzetXVjju5ZTf0QC1VaHtwrCpm79M=',
            'OK-ACCESS-TIMESTAMP': '2023-11-14T22:13:20.000Z',
            'OK-ACCESS-PASSPHRASE': 'test-passphrase',
            'Content-Type': 'application/json'
        });

        return { code: '0', data: [
            { ccy: 'ETH', chain: 'ETH-Ethereum', canWd: false, canDep: false },
            { ccy: 'ETH', chain: 'ETH-Arbitrum One', canWd: true },
            { ccy: 'CLOSED', canWd: false, canDep: false },
            { ccy: 'CLOSED', canWd: false, canDep: false },
            { ccy: 'UNKNOWN' },
            { ccy: 'INCOMPLETE', canWd: false, canDep: false },
            { ccy: 'INCOMPLETE' },
            { ccy: 'XTER', canWd: true }
        ] };
    }, credentials);

    assert.deepEqual(statuses, [{ asset: 'ETH', withdraw: true, deposit: null }, { asset: 'CLOSED', withdraw: false, deposit: false },
        { asset: 'UNKNOWN', withdraw: null, deposit: null }, { asset: 'INCOMPLETE', withdraw: null, deposit: null }]);
});

test('OKX sin las tres credenciales no envía peticiones', async () => {
    for (const keys of [undefined, {}, { apiKey: 'key', apiSecret: 'secret' }, { apiKey: 'key', passphrase: 'pass' }]) {
        assert.deepEqual(await okx.getTransferStatuses(() => assert.fail('Unexpected request'), keys), []);
    }
});

test('OKX rechaza errores, reloj inválido y respuestas incompletas', async () => {
    for (const clock of [{ code: '0', data: [] }, { code: '0', data: [{ ts: 'bad' }] }, { code: '50000' }]) {
        await assert.rejects(okx.getTransferStatuses(async () => clock, credentials), /server time/);
    }

    for (const response of [{ code: '50105' }, { code: '0', data: {} }]) {
        await assert.rejects(okx.getTransferStatuses(async url => url.endsWith('/public/time')
            ? { code: '0', data: [{ ts: '1700000000000' }] } : response, credentials), /currencies request failed/);
    }
});
test('OKX usa el dominio europeo para reloj y consulta firmada y rechaza destinos ajenos', async () => {
    const urls = [];
    await okx.getTransferStatuses(async url => {
        urls.push(url);

        if (url.endsWith('/public/time'))
            return { code: '0', data: [{ ts: '1700000000000' }] };

        return { code: '0', data: [] };
    }, { ...credentials, apiBaseUrl: 'https://eea.okx.com' });

    assert.deepEqual(urls, ['https://eea.okx.com/api/v5/public/time', 'https://eea.okx.com/api/v5/asset/currencies']);
    await assert.rejects(okx.getTransferStatuses(() => assert.fail('Unexpected request'),
        { ...credentials, apiBaseUrl: 'https://example.com' }), /Invalid OKX API domain/);
});
