import test from 'node:test';
import assert from 'node:assert/strict';
import bybit from '../src/03-domain/services/adapters/bybit.js';

const credentials = { apiKey: 'test-key', apiSecret: 'test-secret' };

test('Bybit firma la consulta de monedas con la hora del servidor y evalúa las redes', async () => {
    let calls = 0;
    const statuses = await bybit.getWithdrawalStatuses(async (url, options) => {
        calls++;
        if (calls === 1) {
            assert.equal(url, 'https://api.bybit.com/v5/market/time');
            return { retCode: 0, time: 1700000000000 };
        }
        assert.equal(url, 'https://api.bybit.com/v5/asset/coin/query-info');
        assert.deepEqual(options.headers, {
            'X-BAPI-API-KEY': 'test-key', 'X-BAPI-TIMESTAMP': '1700000000000', 'X-BAPI-RECV-WINDOW': '5000',
            'X-BAPI-SIGN': 'd8d5e71d8f986368aa5c13405f059ab6adb4f41df59d2f11bb056226b63457d6'
        });
        return { retCode: 0, result: { rows: [
            { coin: 'ETH', chains: [{ chainWithdraw: '0', withdrawFee: '1' }, { chainWithdraw: '1', withdrawFee: '0' }] },
            { coin: 'CLOSED', chains: [{ chainWithdraw: '0', withdrawFee: '1' }] },
            { coin: 'UNSUPPORTED', chains: [{ chainWithdraw: '1', withdrawFee: '' }] },
            { coin: 'UNKNOWN', chains: [{ chainWithdraw: 'other' }] }, { coin: 'EMPTY', chains: [] }
        ] } };
    }, credentials);
    assert.deepEqual(statuses, [{ asset: 'ETH', withdraw: true }, { asset: 'CLOSED', withdraw: false },
        { asset: 'UNSUPPORTED', withdraw: false }, { asset: 'UNKNOWN', withdraw: null }, { asset: 'EMPTY', withdraw: null }]);
});

test('Bybit no consulta con credenciales incompletas', async () => {
    for (const keys of [undefined, {}, { apiKey: 'key' }, { apiSecret: 'secret' }])
        assert.deepEqual(await bybit.getWithdrawalStatuses(() => assert.fail('Unexpected request'), keys), []);
});

test('Bybit rechaza errores y respuestas incompletas sin convertirlos en retiradas bloqueadas', async () => {
    await assert.rejects(bybit.getWithdrawalStatuses(async () => ({ retCode: 0 }), credentials), /server time/);
    for (const result of [{ retCode: 10003 }, { retCode: 0, result: {} }]) {
        await assert.rejects(bybit.getWithdrawalStatuses(async url => url.endsWith('/time')
            ? { retCode: 0, time: 1700000000000 } : result, credentials), /currencies request failed/);
    }
});
