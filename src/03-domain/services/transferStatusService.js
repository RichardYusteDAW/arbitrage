class TransferStatusService {
    #statuses = new Map();

    constructor(maxAge) {
        this.maxAge = maxAge;
    }

    update(exchange, statuses) {
        this.#statuses.set(exchange, {
            receivedAt: Date.now(),
            assets: new Map(statuses.map(({ asset, withdraw, deposit }) => [asset, { withdraw, deposit }]))
        });
    }

    get(exchange, asset, direction = 'withdraw') {
        const snapshot = this.#statuses.get(exchange);

        if (!snapshot || Date.now() - snapshot.receivedAt > this.maxAge)
            return null;

        const status = snapshot.assets.get(asset)?.[direction];
        return typeof status === 'boolean' ? status : null;
    }

    clear(exchange) {
        if (exchange === undefined)
            this.#statuses.clear();
        else
            this.#statuses.delete(exchange);
    }
}

export default TransferStatusService;
