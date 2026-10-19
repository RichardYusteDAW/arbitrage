import PairDiscoveryService from '../../../03-domain/services/pairDiscoveryService.js';
import { EXCHANGES } from '../../../config.js';

let instance;

const getPairDiscoveryService = () => {
    if (!instance)
        instance = new PairDiscoveryService(EXCHANGES);

    return instance;
};

export { getPairDiscoveryService };