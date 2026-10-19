import test from 'node:test';
import assert from 'node:assert/strict';
import { getPairDiscoveryService } from '../src/01-common/containers/services/pairDiscoveryIoC.js';
import { getConnectionService } from '../src/01-common/containers/services/connectionIoC.js';
import { getQuoteStoreService } from '../src/01-common/containers/services/quoteStoreIoC.js';
import { getRequestClientService } from '../src/01-common/containers/services/requestClientIoC.js';
import { getPairSelectionService } from '../src/01-common/containers/services/pairSelectionIoC.js';
import { createWebSocketConnectionService } from '../src/01-common/containers/services/webSocketConnectionIoC.js';
import { getStartMarketDataUseCase } from '../src/01-common/containers/usecases/startMarketDataUseCaseIoC.js';
import { getStopMarketDataUseCase } from '../src/01-common/containers/usecases/stopMarketDataUseCaseIoC.js';
import { getOpportunitiesUseCase } from '../src/01-common/containers/usecases/getOpportunitiesUseCaseIoC.js';
import { getMarketStatusUseCase } from '../src/01-common/containers/usecases/getMarketStatusUseCaseIoC.js';
import { ticker } from './fixtures.js';

test('los contenedores comparten instancias y las consultas y parada usan las mismas cotizaciones', t => {
    const getters = [getPairDiscoveryService, getConnectionService, getQuoteStoreService, getRequestClientService,
        getPairSelectionService, getStartMarketDataUseCase, getStopMarketDataUseCase,
        getOpportunitiesUseCase, getMarketStatusUseCase];
    for (const get of getters) assert.equal(get(), get());

    const quotes = getQuoteStoreService();
    const stop = getStopMarketDataUseCase();
    t.after(() => stop.execute());
    quotes.update('binance', [ticker()]);
    quotes.update('kraken', [ticker({ askPrice: 103, bidPrice: 102 })]);
    assert.equal(getMarketStatusUseCase().execute().kraken.quotes, 1);
    assert.ok(Math.abs(getOpportunitiesUseCase().execute()[0].profitability - 1.798 / 100.1 * 100) < 1e-10);
    stop.execute();
    assert.equal(getMarketStatusUseCase().execute().kraken.quotes, 0);
    assert.deepEqual(getOpportunitiesUseCase().execute(), []);
});

test('la factoría de conexiones mantiene un ciclo de vida independiente para cada grupo', () => {
    const options = { exchangeName: 'test', config: {}, pairs: [],
        onTickers() {}, onDisconnect() {}, onState() {} };
    const first = createWebSocketConnectionService(options);
    const second = createWebSocketConnectionService(options);
    assert.notEqual(first, second);
    first.stop();
    assert.equal(first.stopped, true);
    assert.equal(second.stopped, false);
    second.stop();
});
