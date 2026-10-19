import RequestClientService from '../../../03-domain/services/requestClientService.js';

let instance;

const getRequestClientService = () => {
    if (!instance) 
        instance = new RequestClientService();
    
    return instance;
};

export { getRequestClientService };