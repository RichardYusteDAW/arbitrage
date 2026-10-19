import test from 'node:test';
import assert from 'node:assert/strict';
import transferNetworks from '../src/01-common/transferNetworks.js';
import TransferStatusService from '../src/03-domain/services/transferStatusService.js';
import GetOpportunitiesUseCase from '../src/03-domain/usecases/GetOpportunitiesUseCase.js';
import bybit from '../src/03-domain/services/adapters/bybit.js';
import kucoin from '../src/03-domain/services/adapters/kucoin.js';
import bitvavo from '../src/03-domain/services/adapters/bitvavo.js';
import kraken from '../src/03-domain/services/adapters/kraken.js';

const asset = entries => [{ asset: 'OBT', withdraw: true, deposit: true, ...transferNetworks(entries) }];

test('solo sirve una red comun con retirada de origen y deposito de destino habilitados', () => {
    const store = new TransferStatusService(120000);
    store.update('buy', asset([{ name: 'BASE', withdraw: true }, { name: 'ARBI', withdraw: false }]));
    store.update('sell', asset([{ name: 'ARBEVM', deposit: true }]));
    assert.equal(store.canTransfer('buy', 'sell', 'OBT'), false);
    store.update('buy', asset([{ name: 'ARBI', withdraw: true }]));
    assert.equal(store.canTransfer('buy', 'sell', 'OBT'), true);
    store.update('sell', asset([{ name: 'Arbitrum Nova', deposit: true }]));
    assert.equal(store.canTransfer('buy', 'sell', 'OBT'), false);
    store.update('sell', asset([{ name: 'Arbitrum One', deposit: false }]));
    assert.equal(store.canTransfer('buy', 'sell', 'OBT'), false);
});

test('datos incompletos, redes desconocidas y datos caducados no confirman ni bloquean rutas', t => {
    t.mock.timers.enable({ apis: ['Date'], now: 100000 });
    const store = new TransferStatusService(120000);
    store.update('buy', asset([{ name: 'ETH', withdraw: true }]));
    assert.equal(store.canTransfer('buy', 'sell', 'OBT'), null);

    for (const entries of [[{ name: 'NEW', deposit: true }], [{ name: 'ERC20' }],
        [{ name: 'BASE', deposit: true }, { deposit: true }]]) {
        store.update('sell', asset(entries));
        assert.equal(store.canTransfer('buy', 'sell', 'OBT'), null);
    }
    store.update('sell', asset([{ name: 'ERC20', deposit: true }]));
    assert.equal(store.canTransfer('buy', 'sell', 'OBT'), true);
    t.mock.timers.tick(120001);
    assert.equal(store.canTransfer('buy', 'sell', 'OBT'), null);
});

test('OBT de Bybit a Kucoin se filtra aunque ambos wallets esten habilitados', async () => {
    const store = new TransferStatusService(120000);
    store.update('bybit', await bybit.getTransferStatuses(async url => url.endsWith('/time')
        ? { retCode: 0, time: 1700000000000 }
        : { retCode: 0, result: { rows: [{ coin: 'OBT', chains: [
            { chain: 'BASE', chainWithdraw: '1', chainDeposit: '1' },
            { chain: 'ARBI', chainWithdraw: '0', chainDeposit: '1' }
        ] }] } }, { apiKey: 'test', apiSecret: 'test' }));
    store.update('kucoin', await kucoin.getTransferStatuses(async () => ({ code: '200000', data: [
        { currency: 'OBT', chains: [{ chainId: 'arbitrum', isDepositEnabled: true, isWithdrawEnabled: true }] }
    ] })));
    const opportunity = { symbol: 'OBTUSDT', buy: 'bybit', sell: 'kucoin' };
    const data = { bybit: [{ symbol: 'OBTUSDT', baseAsset: 'OBT' }] };
    const useCase = new GetOpportunitiesUseCase({ getData: () => data }, () => [{ ...opportunity }], store);
    assert.equal(store.get('bybit', 'OBT'), true);
    assert.equal(store.get('kucoin', 'OBT', 'deposit'), true);
    assert.deepEqual(useCase.execute(), []);
});

test('Bitvavo no atribuye un estado agregado habilitado a todas sus redes', async () => {
    const statuses = await bitvavo.getTransferStatuses(async () => [
        { symbol: 'ETH', networks: ['ETH', 'BASE'], withdrawalStatus: 'OK', depositStatus: 'OK' }
    ]);
    assert.equal(statuses[0].withdraw, true);
    assert.ok(statuses[0].networks.every(network => network.withdraw === null && network.deposit === null));
});

test('Kraken pagina metodos y conserva por separado redes de retirada y deposito', async () => {
    const method = name => ({ asset: { class: 'currency', name: 'ETH' }, network: { network_name: name } });
    const statuses = await kraken.getTransferStatuses(async url => {
        if (url.includes('/withdraw?limit='))
            return { methods: [method('Ethereum')], next_cursor: 'next' };

        if (url.includes('/withdraw?cursor=next'))
            return { methods: [method('Base')] };

        if (url.includes('/deposit?limit='))
            return { methods: [method('Ethereum')] };

        assert.equal(url, 'https://api.kraken.com/0/public/Assets');
        return { error: [], result: { ETH: { altname: 'ETH', status: 'enabled' } } };
    }, { apiKey: 'test', apiSecret: 'dGVzdA==' });
    assert.deepEqual(statuses[0].networks, [
        { id: 'ethereum', name: 'Ethereum', withdraw: true, deposit: true },
        { id: 'base', name: 'Base', withdraw: true, deposit: false }
    ]);
});
