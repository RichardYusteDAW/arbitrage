import test from 'node:test';
import assert from 'node:assert/strict';
import TransferStatusService from '../src/03-domain/services/transferStatusService.js';
import RefreshTransferStatusUseCase from '../src/03-domain/usecases/RefreshTransferStatusUseCase.js';
import GetOpportunitiesUseCase from '../src/03-domain/usecases/GetOpportunitiesUseCase.js';
import { calculateOpportunities } from '../src/03-domain/helpers/calculations.js';
import availability from '../src/01-common/transferAvailability.js';
import kucoin from '../src/03-domain/services/adapters/kucoin.js';
import bitget from '../src/03-domain/services/adapters/bitget.js';
import gateio from '../src/03-domain/services/adapters/gateio.js';
import { ticker, flush } from './fixtures.js';
import { formatOpportunity } from '../src/02-presentation/console.js';

test('retiradas distinguen alguna red habilitada, todas bloqueadas y datos incompletos', () => {
    assert.equal(availability([false, true]), true);
    assert.equal(availability([true, undefined]), true);
    assert.equal(availability([false, false]), false);
    assert.equal(availability([false, undefined]), null);
    assert.equal(availability([]), null);
});

test('adaptadores consultan listas públicas y aplican las mismas excepciones que los pares', async () => {
    const kucoinStatuses = await kucoin.getTransferStatuses(async url => {
        assert.equal(url, 'https://api.kucoin.com/api/v3/currencies');
        return { code: '200000', data: [{ currency: 'SUP', chains: [{ isWithdrawEnabled: false, isDepositEnabled: false }, { isWithdrawEnabled: true }] },
            { currency: 'ILY', chains: [{ isWithdrawEnabled: false, isDepositEnabled: false }] }, { currency: 'UNKNOWN', chains: [] }] };
    });
    assert.deepEqual(kucoinStatuses, [{ asset: 'SUPERP', withdraw: true, deposit: null }, { asset: 'ILY', withdraw: false, deposit: false }, { asset: 'UNKNOWN', withdraw: null, deposit: null }]);
    const bitgetStatuses = await bitget.getTransferStatuses(async url => {
        assert.equal(url, 'https://api.bitget.com/api/v2/spot/public/coins');
        return { code: '00000', data: [{ coin: 'SUP', chains: [{ withdrawable: 'false', rechargeable: 'false' }] },
            { coin: 'ETH', chains: [{ withdrawable: 'true', rechargeable: 'true' }] }, { coin: 'BAD', chains: [{}] }] };
    });
    assert.deepEqual(bitgetStatuses, [{ asset: 'SUPERP', withdraw: false, deposit: false }, { asset: 'ETH', withdraw: true, deposit: true }, { asset: 'BAD', withdraw: null, deposit: null }]);
    const gateStatuses = await gateio.getTransferStatuses(async url => {
        assert.equal(url, 'https://api.gateio.ws/api/v4/spot/currencies');
        return [{ currency: 'EDGE', withdraw_disabled: true, chains: [{ withdraw_disabled: false, withdraw_delayed: false }] },
            { currency: 'ILY', chains: [{ withdraw_disabled: false, withdraw_delayed: true, deposit_disabled: false }] },
            { currency: 'ETH', withdraw_disabled: false, deposit_disabled: false }, { currency: 'BAD', chains: [{}] }];
    });
    assert.deepEqual(gateStatuses, [{ asset: 'DEFINITIVE', withdraw: true, deposit: null }, { asset: 'ILY', withdraw: false, deposit: true },
        { asset: 'ETH', withdraw: true, deposit: true }, { asset: 'BAD', withdraw: null, deposit: null }]);
    await assert.rejects(kucoin.getTransferStatuses(async () => ({ code: '500', msg: 'Failed' })), /Failed/);
    await assert.rejects(bitget.getTransferStatuses(async () => ({ code: '500', msg: 'Failed' })), /Failed/);
    await assert.rejects(gateio.getTransferStatuses(async () => ({ message: 'Failed' })), /Failed/);
});

test('estados caducados y monedas ausentes son desconocidos, nunca falsos bloqueos', t => {
    t.mock.timers.enable({ apis: ['Date'], now: 100000 });
    const store = new TransferStatusService(120000);
    store.update('a', [{ asset: 'ETH', withdraw: false, deposit: null }]);
    assert.equal(store.get('a', 'ETH'), false);
    assert.equal(store.get('a', 'BTC'), null);
    assert.equal(store.get('b', 'ETH'), null);
    t.mock.timers.tick(120001);
    assert.equal(store.get('a', 'ETH'), null);
});

test('las oportunidades muestran la retirada del exchange de compra usando el activo normalizado', () => {
    const store = new TransferStatusService(120000);
    store.update('a', [{ asset: 'SUPERP', withdraw: false, deposit: null }]);
    store.update('b', [{ asset: 'SUPERP', withdraw: true, deposit: false }]);
    const data = { a: [ticker({ symbol: 'SUPERPUSD', baseAsset: 'SUPERP', askPrice: 100, bidPrice: 99 })],
        b: [ticker({ symbol: 'SUPERPUSD', baseAsset: 'SUPERP', askPrice: 103, bidPrice: 102 })] };
    const useCase = new GetOpportunitiesUseCase({ getData: () => data }, calculateOpportunities, store);
    const result = useCase.execute()[0];
    assert.equal(result.withdraw, false);
    assert.equal(result.deposit, false);
    assert.equal(formatOpportunity(result).deposit, false);
    assert.equal(formatOpportunity(result).withdraw, false);
    store.clear('b');
    assert.equal(useCase.execute()[0].deposit, null);
    store.update('b', [{ asset: 'SUPERP', withdraw: false, deposit: true }]);
    assert.equal(useCase.execute()[0].deposit, true);
    store.clear('a');
    assert.equal(useCase.execute()[0].withdraw, null);
    store.update('a', [{ asset: 'SUPERP', withdraw: true, deposit: null }]);
    assert.equal(useCase.execute()[0].withdraw, true);
});

test('la actualización periódica aísla errores, recupera estados y se cancela al detener', async t => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100000 });
    const store = new TransferStatusService(120000);
    let attempts = 0;
    const exchanges = { a: { adapter: { getTransferStatuses: async request => {
        attempts++;
        if (attempts === 2) throw new Error('Offline');
        return request('currencies');
    } } }, unsupported: { adapter: {} } };
    const useCase = new RefreshTransferStatusUseCase(exchanges, {
        request: async () => [{ asset: 'ETH', withdraw: true, deposit: null }]
    }, store, 60000);
    t.after(() => useCase.stop());
    useCase.execute();
    useCase.execute();
    await flush();
    assert.equal(attempts, 1);
    assert.equal(store.get('a', 'ETH'), true);
    t.mock.timers.tick(60000);
    await flush();
    assert.equal(store.get('a', 'ETH'), null);
    t.mock.timers.tick(60000);
    await flush();
    assert.equal(store.get('a', 'ETH'), true);
    assert.equal(store.get('unsupported', 'ETH'), null);
    useCase.stop();
    t.mock.timers.tick(60000);
    await flush();
    assert.equal(attempts, 3);
    assert.equal(store.get('a', 'ETH'), null);
});

test('detener impide que una respuesta tardía repueble los estados', async () => {
    const store = new TransferStatusService(120000);
    let resolve;
    const useCase = new RefreshTransferStatusUseCase({ a: { adapter: {
        getTransferStatuses: () => new Promise(done => { resolve = done; })
    } } }, {}, store, 60000);
    useCase.execute();
    useCase.stop();
    resolve([{ asset: 'ETH', withdraw: true, deposit: null }]);
    await flush();
    assert.equal(store.get('a', 'ETH'), null);
});
