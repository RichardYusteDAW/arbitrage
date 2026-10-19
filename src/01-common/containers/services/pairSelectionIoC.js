import PairSelectionService from '../../../03-domain/services/pairSelectionService.js';

let instance;

const getPairSelectionService = () => {
    if (!instance)
        instance = new PairSelectionService();

    return instance;
};

export { getPairSelectionService };