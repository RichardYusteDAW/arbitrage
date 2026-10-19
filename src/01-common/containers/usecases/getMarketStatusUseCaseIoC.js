import GetMarketStatusUseCase from '../../../03-domain/usecases/GetMarketStatusUseCase.js';
import { getPairDiscoveryService } from '../services/pairDiscoveryIoC.js';
import { getConnectionService } from '../services/connectionIoC.js';
import { getQuoteStoreService } from '../services/quoteStoreIoC.js';

let instance;

const getMarketStatusUseCase = () => {
    if (!instance)
        instance = new GetMarketStatusUseCase(getPairDiscoveryService(), getConnectionService(), getQuoteStoreService());

    return instance;
};

export { getMarketStatusUseCase };