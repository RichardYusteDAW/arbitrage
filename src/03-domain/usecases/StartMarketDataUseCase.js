class StartMarketDataUseCase {

    constructor({ pairDiscovery,
        connections,
        quoteStore,
        requestClient,
        pairSelection,
        createConnection,
        WebSocketImpl,
        reconnectDelay,
        timing 
    }) {
        this.discovery = pairDiscovery;
        this.connections = connections;
        this.quotes = quoteStore;
        this.client = requestClient;
        this.pairSelection = pairSelection;
        this.createConnection = createConnection;
        this.WebSocketImpl = WebSocketImpl;
        this.reconnectDelay = reconnectDelay;
        this.timing = timing;
    }

    rebuildConnections() {
        for (const connection of this.connections.getConnections())
            connection.stop();
        this.connections.clear();
        this.quotes.clear();

        for (const [exchangeName, pairs] of Object.entries(this.pairSelection.selectPairs(this.discovery.getCatalogs()))) {
            const config = this.discovery.getConfig(exchangeName);
            this.connections.setState(exchangeName, pairs.length ? 'conectando' : 'sin pares compartidos');

            for (let index = 0; index < pairs.length; index += config.maxPairsPerConnection) {
                const groupPairs = pairs.slice(index, index + config.maxPairsPerConnection);
                const connection = this.createConnection({
                    exchangeName,
                    config,
                    pairs: groupPairs,
                    WebSocketImpl: this.WebSocketImpl,
                    reconnectDelay: this.reconnectDelay,
                    onTickers: tickers => this.quotes.update(exchangeName, tickers),
                    onDisconnect: () => this.quotes.remove(exchangeName, groupPairs),
                    onState: (state, error) => this.connections.setState(exchangeName, state, error)
                });
                this.connections.register(connection);
                connection.start((index / config.maxPairsPerConnection) * this.timing.connectionStagger);
            }
        }
    }

    async discover(exchangeName) {
        this.connections.setState(exchangeName, 'cargando pares');
        try {
            const discovered = await this.discovery.discover(exchangeName, url => this.client.request(url));
            if (!discovered) return;
            this.rebuildConnections();
        } catch (error) {
            if (this.discovery.isStopped()) return;
            this.connections.setState(exchangeName, 'reintentando pares', error.message);
            this.discovery.scheduleRetry(() => { void this.discover(exchangeName); }, this.timing.discoveryRetryDelay);
        }
    }

    execute() {
        if (!this.discovery.begin()) return;
        if (!this.WebSocketImpl)
            throw new Error('WebSocket unavailable: use Node.js 22 or newer');
        for (const name of this.discovery.getExchangeNames())
            void this.discover(name);
    }
}

export default StartMarketDataUseCase;