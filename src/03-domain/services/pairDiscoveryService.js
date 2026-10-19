class PairDiscoveryService {

    #exchanges;
    #catalogs = {};
    #retryTimers = new Set();
    #started = false;
    #stopped = false;

    constructor(exchanges) {
        this.#exchanges = exchanges;
    }

    getExchangeNames() {
        return Object.keys(this.#exchanges);
    }

    getConfig(exchangeName) {
        return this.#exchanges[exchangeName];
    }

    getCatalogs() {
        return Object.fromEntries(Object.entries(this.#catalogs).map(([name, pairs]) => [name, [...pairs]]));
    }

    begin() {
        if (this.#started) return false;
        this.#started = true;
        return true;
    }

    isStopped() {
        return this.#stopped;
    }

    async discover(exchangeName, request) {
        const config = this.getConfig(exchangeName);
        const pairs = await config.adapter.discover(config, request);
        if (this.#stopped) return false;
        this.#catalogs[exchangeName] = pairs;
        return true;
    }

    scheduleRetry(callback, delay) {
        const timer = setTimeout(() => {
            this.#retryTimers.delete(timer);
            callback();
        }, delay);
        this.#retryTimers.add(timer);
    }

    stop() {
        this.#stopped = true;
        for (const timer of this.#retryTimers) clearTimeout(timer);
        this.#retryTimers.clear();
    }
}

export default PairDiscoveryService;