import RefreshWithdrawalStatusUseCase from '../../../03-domain/usecases/RefreshWithdrawalStatusUseCase.js';
import { EXCHANGES, TIMING } from '../../../config.js';
import { getRequestClientService } from '../services/requestClientIoC.js';
import { getWithdrawalStatusService } from '../services/withdrawalStatusIoC.js';

let instance;
const getRefreshWithdrawalStatusUseCase = () => {
    if (!instance) instance = new RefreshWithdrawalStatusUseCase(
        EXCHANGES, getRequestClientService(), getWithdrawalStatusService(), TIMING.withdrawalRefreshInterval);
    return instance;
};

export { getRefreshWithdrawalStatusUseCase };
