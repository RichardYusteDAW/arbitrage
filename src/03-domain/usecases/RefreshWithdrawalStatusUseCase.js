class RefreshWithdrawalStatusUseCase {
    constructor(exchanges, requestClient, withdrawalStatus, interval, credentials = {}) {
        this.exchanges = exchanges;
        this.credentials = credentials;
        this.client = requestClient;
        this.withdrawalStatus = withdrawalStatus;
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
            if (!config.adapter.getWithdrawalStatuses)
                return;

            try {
                const statuses = await config.adapter.getWithdrawalStatuses((url, options) => this.client.request(url, options), this.credentials[exchange]);

                if (!this.stopped)
                    this.withdrawalStatus.update(exchange, statuses);
            } catch {
                if (!this.stopped)
                    this.withdrawalStatus.clear(exchange);
            }
        }));

        if (!this.stopped)
            this.timer = setTimeout(() => { void this.refresh(); }, this.interval);
    }

    stop() {
        this.stopped = true;
        clearTimeout(this.timer);
        this.withdrawalStatus.clear();
    }
}

export default RefreshWithdrawalStatusUseCase;
