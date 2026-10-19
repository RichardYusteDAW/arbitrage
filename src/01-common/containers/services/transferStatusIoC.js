import TransferStatusService from '../../../03-domain/services/transferStatusService.js';
import { TIMING } from '../../../config.js';

let instance;

const getTransferStatusService = () => {
    if (!instance)
        instance = new TransferStatusService(TIMING.transferRefreshInterval * 2);

    return instance;
};

export { getTransferStatusService };