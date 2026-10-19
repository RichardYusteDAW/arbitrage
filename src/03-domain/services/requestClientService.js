import { TIMING } from '../../config.js';

class RequestClientService {
    
    constructor({ fetchImpl = globalThis.fetch, timeout = TIMING.requestTimeout } = {}) {
        this.fetchImpl = fetchImpl;
        this.timeout = timeout;
        this.pendingRequests = new Set();
    }

    async request(url) {
        const controller = new AbortController();
        this.pendingRequests.add(controller);
        const timer = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await this.fetchImpl(url, { signal: controller.signal });
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } finally {
            clearTimeout(timer);
            this.pendingRequests.delete(controller);
        }
    }

    abortAll() {
        for (const controller of this.pendingRequests)
            controller.abort();
    }
}

export default RequestClientService;