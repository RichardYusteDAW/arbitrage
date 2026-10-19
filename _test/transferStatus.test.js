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

for (const withdraw of [true, false, null]) {
    for (const deposit of [true, false, null]) {
        test(`filtra oportunidades segun retirada de compra (${withdraw}) y deposito de venta (${deposit})`, () => {
            const store = new TransferStatusService(120000);
            store.update('a', [{ asset: 'SUPERP', withdraw, deposit: false }]);
            store.update('b', [{ asset: 'SUPERP', withdraw: false, deposit }]);
            const data = {
                a: [ticker({ symbol: 'SUPERPUSD', baseAsset: 'SUPERP', askPrice: 100, bidPrice: 99 })],
                b: [ticker({ symbol: 'SUPERPUSD', baseAsset: 'SUPERP', askPrice: 103, bidPrice: 102 })]
            };
            const useCase = new GetOpportunitiesUseCase({ getData: () => data }, calculateOpportunities, store);
            const results = useCase.execute();

            if (withdraw === false || deposit === false) {
                assert.deepEqual(results, []);
                return;
            }

            assert.equal(results.length, 1);
            assert.equal(results[0].withdraw, withdraw);
            assert.equal(results[0].deposit, deposit);
            assert.equal(formatOpportunity(results[0]).withdraw, withdraw);
            assert.equal(formatOpportunity(results[0]).deposit, deposit);
        });
    }
}


