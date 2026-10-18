import { TIMING } from '../data/settings.js';

const createRequestClient = ({ fetchImpl = globalThis.fetch, timeout = TIMING.requestTimeout } = {}) => {
    const pendingRequests = new Set();

    const request = async url => {
        const controller = new AbortController();
        pendingRequests.add(controller);
        const timer = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetchImpl(url, { signal: controller.signal });

            if (!response.ok) 
                throw new Error(`HTTP ${response.status}`);

            return await response.json();

        } finally {
            clearTimeout(timer);
            pendingRequests.delete(controller);
        }
    };

    const abortAll = () => {
        for (const controller of pendingRequests) 
            controller.abort();
    };

    return { request, abortAll };
};

export { createRequestClient };