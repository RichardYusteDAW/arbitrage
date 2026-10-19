import WithdrawalStatusService from '../../../03-domain/services/withdrawalStatusService.js';
import { TIMING } from '../../../config.js';

let instance;

const getWithdrawalStatusService = () => {
    if (!instance)
        instance = new WithdrawalStatusService(TIMING.withdrawalRefreshInterval * 2);

    return instance;
};

export { getWithdrawalStatusService };
