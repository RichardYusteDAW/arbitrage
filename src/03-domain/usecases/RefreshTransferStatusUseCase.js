class RefreshTransferStatusUseCase {
    constructor(exchanges, requestClient, transferStatus, interval, credentials = {}) {
        this.exchanges = exchanges;
        this.credentials = credentials;
        this.client = requestClient;
        this.transferStatus = transferStatus;
        this.interval = interval;
        this.started = false;
        this.stopped = false;
    }

    execute() {
        if (this.started)
            return;

        this.started = true;
        void this.refresh();
    }

    async refresh() {
        await Promise.all(Object.entries(this.exchanges).map(async ([exchange, config]) => {
            if (!config.adapter.getTransferStatuses)
                return;

            try {
                const statuses = await config.adapter.getTransferStatuses((url, options) => this.client.request(url, options), this.credentials[exchange]);

                if (!this.stopped)
                    this.transferStatus.update(exchange, statuses);
            } catch {
                if (!this.stopped)
                    this.transferStatus.clear(exchange);
            }
        }));

        if (!this.stopped)
            this.timer = setTimeout(() => { void this.refresh(); }, this.interval);
    }

    stop() {
        this.stopped = true;
        clearTimeout(this.timer);
        this.transferStatus.clear();
    }
}

export default RefreshTransferStatusUseCase;