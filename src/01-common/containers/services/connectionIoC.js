import ConnectionService from '../../../03-domain/services/connectionService.js';
import { EXCHANGES } from '../../../config.js';

let instance;

const getConnectionService = () => {
    if (!instance)
        instance = new ConnectionService(Object.keys(EXCHANGES));

    return instance;
};

export { getConnectionService };