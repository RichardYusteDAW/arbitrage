import { getWithdrawalStatusService } from '../services/withdrawalStatusIoC.js';
import GetOpportunitiesUseCase from '../../../03-domain/usecases/GetOpportunitiesUseCase.js';
import { calculateOpportunities } from '../../../03-domain/helpers/calculations.js';
import { getQuoteStoreService } from '../services/quoteStoreIoC.js';

let instance;

const getOpportunitiesUseCase = () => {
    if (!instance)
        instance = new GetOpportunitiesUseCase(getQuoteStoreService(), calculateOpportunities, getWithdrawalStatusService());

    return instance;
};

export { getOpportunitiesUseCase };