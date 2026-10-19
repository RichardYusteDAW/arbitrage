class TransferStatusService {
    #statuses = new Map();

    constructor(maxAge) {
        this.maxAge = maxAge;
    }

    update(exchange, statuses) {
        this.#statuses.set(exchange, {
            receivedAt: Date.now(),
            assets: new Map(statuses.map(({ asset, withdraw, deposit, networks }) => [asset, { withdraw, deposit, networks }]))
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

    canTransfer(origin, destination, asset) {
        if (this.get(origin, asset) === false || this.get(destination, asset, 'deposit') === false)
            return false;

        const current = exchange => {
            const snapshot = this.#statuses.get(exchange);
            return snapshot && Date.now() - snapshot.receivedAt <= this.maxAge
                ? snapshot.assets.get(asset)?.networks : undefined;
        };
        const source = current(origin);
        const target = current(destination);

        if (!source?.length || !target?.length)
            return null;

        let unknown = false;

        for (const from of source) {
            for (const to of target) {
                if (from.withdraw === false || to.deposit === false)
                    continue;

                if (!from.id || !to.id) {
                    unknown = true;
                    continue;
                }

                if (from.id !== to.id)
                    continue;

                if (from.withdraw === true && to.deposit === true)
                    return true;

                unknown = true;
            }
        }

        return unknown ? null : false;
    }
}

export default TransferStatusService;