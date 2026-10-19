class StopMarketDataUseCase {

    constructor(pairDiscovery, connections, requestClient, quoteStore) {
        this.discovery = pairDiscovery;
        this.connections = connections;
        this.client = requestClient;
        this.quotes = quoteStore;
    }

    execute() {
        this.discovery.stop();
        this.client.abortAll();
        for (const connection of this.connections.getConnections())
            connection.stop();
        this.connections.clear();
        this.quotes.clear();
    }
}

export default StopMarketDataUseCase;