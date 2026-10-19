import test from 'node:test';
import assert from 'node:assert/strict';
import binance from '../src/03-domain/services/adapters/binance.js';

test('Binance firma la consulta con la hora del servidor y envía la clave solo en la cabecera', async () => {
    const calls = [];
    const statuses = await binance.getTransferStatuses(async (url, options) => {
        calls.push({ url, options });
        if (calls.length === 1) return { serverTime: 1700000000000 };
        const request = new URL(url);
        assert.equal(request.origin, 'https://api.binance.com');
        assert.equal(request.pathname, '/sapi/v1/capital/config/getall');
        assert.equal(request.searchParams.get('timestamp'), '1700000000000');
        assert.equal(request.searchParams.get('recvWindow'), '5000');
        assert.equal(request.searchParams.get('signature'), '3c006375c631729ab444c2afb86bee2999c35b6eeec838b8f96697e8f096d7b3');
        assert.equal(request.searchParams.has('apiKey'), false);
        assert.equal(request.searchParams.has('apiSecret'), false);
        assert.deepEqual(options.headers, { 'X-MBX-APIKEY': 'test-key' });
        return [
            { coin: 'ETH', withdrawAllEnable: true, networkList: [{ withdrawEnable: false, depositEnable: false }, { withdrawEnable: true }] },
            { coin: 'BTC', withdrawAllEnable: false, networkList: [{ withdrawEnable: true }] },
            { coin: 'CLOSED', networkList: [{ withdrawEnable: false, depositEnable: false }] },
            { coin: 'UNKNOWN', networkList: [] }
        ];
    }, { apiKey: 'test-key', apiSecret: 'test-secret' });
    assert.equal(calls[0].url, 'https://api.binance.com/api/v3/time');
    assert.deepEqual(statuses, [{ asset: 'ETH', withdraw: true, deposit: null }, { asset: 'BTC', withdraw: false, deposit: null },
        { asset: 'CLOSED', withdraw: false, deposit: false }, { asset: 'UNKNOWN', withdraw: null, deposit: null }]);
});

test('Binance sin ambas credenciales no envía peticiones autenticadas', async () => {
    for (const credentials of [undefined, {}, { apiKey: 'test-key' }, { apiSecret: 'test-secret' }]) {
        assert.deepEqual(await binance.getTransferStatuses(() => assert.fail('Unexpected request'), credentials), []);
    }
});

test('Binance rechaza reloj o respuestas inválidas sin incluir credenciales en sus errores', async () => {
    const credentials = { apiKey: 'test-key', apiSecret: 'test-secret' };
    await assert.rejects(binance.getTransferStatuses(async () => ({}), credentials), /Invalid Binance server time/);
    await assert.rejects(binance.getTransferStatuses(async url => url.endsWith('/time')
        ? { serverTime: 1700000000000 } : { code: -2015, msg: 'Denied' }, credentials), /Binance currencies request failed/);
});
