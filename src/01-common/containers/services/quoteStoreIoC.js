import QuoteStoreService from '../../../03-domain/services/quoteStoreService.js';
import { EXCHANGES, TIMING } from '../../../config.js';

let instance;

const getQuoteStoreService = () => {
    if (!instance)
        instance = new QuoteStoreService(Object.keys(EXCHANGES), TIMING.quoteMaxAge);

    return instance;
};

export { getQuoteStoreService };