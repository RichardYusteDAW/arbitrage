import StartMarketDataUseCase from '../../../03-domain/usecases/StartMarketDataUseCase.js';
import { TIMING } from '../../../config.js';
import { getPairDiscoveryService } from '../services/pairDiscoveryIoC.js';
import { getConnectionService } from '../services/connectionIoC.js';
import { getQuoteStoreService } from '../services/quoteStoreIoC.js';
import { getRequestClientService } from '../services/requestClientIoC.js';
import { getPairSelectionService } from '../services/pairSelectionIoC.js';
import { createWebSocketConnectionService } from '../services/webSocketConnectionIoC.js';

let instance;

const getStartMarketDataUseCase = () => {
    if (!instance)
        instance = new StartMarketDataUseCase({
            pairDiscovery: getPairDiscoveryService(),
            connections: getConnectionService(),
            quoteStore: getQuoteStoreService(),
            requestClient: getRequestClientService(),
            pairSelection: getPairSelectionService(),
            createConnection: createWebSocketConnectionService,
            WebSocketImpl: globalThis.WebSocket,
            reconnectDelay: TIMING.reconnectDelay,
            timing: TIMING
        });

    return instance;
};

export { getStartMarketDataUseCase };