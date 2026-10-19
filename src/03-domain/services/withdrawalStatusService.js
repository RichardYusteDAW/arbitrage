class WithdrawalStatusService {
    #statuses = new Map();

    constructor(maxAge) {
        this.maxAge = maxAge;
    }

    update(exchange, statuses) {
        this.#statuses.set(exchange, {
            receivedAt: Date.now(),
            assets: new Map(statuses.map(({ asset, withdraw }) => [asset, withdraw]))
        });
    }

    get(exchange, asset) {
        const snapshot = this.#statuses.get(exchange);
        if (!snapshot || Date.now() - snapshot.receivedAt > this.maxAge) return null;
        const status = snapshot.assets.get(asset);
        return typeof status === 'boolean' ? status : null;
    }

    clear(exchange) {
        if (exchange === undefined) this.#statuses.clear();
        else this.#statuses.delete(exchange);
    }
}

export default WithdrawalStatusService;
