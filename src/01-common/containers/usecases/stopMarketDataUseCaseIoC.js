import StopMarketDataUseCase from '../../../03-domain/usecases/StopMarketDataUseCase.js';
import { getPairDiscoveryService } from '../services/pairDiscoveryIoC.js';
import { getConnectionService } from '../services/connectionIoC.js';
import { getQuoteStoreService } from '../services/quoteStoreIoC.js';
import { getRequestClientService } from '../services/requestClientIoC.js';

let instance;

const getStopMarketDataUseCase = () => {
    if (!instance)
        instance = new StopMarketDataUseCase(getPairDiscoveryService(), getConnectionService(), getRequestClientService(), getQuoteStoreService());

    return instance;
};

export { getStopMarketDataUseCase };