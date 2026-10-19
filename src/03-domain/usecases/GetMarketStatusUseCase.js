class GetMarketStatusUseCase {

    constructor(pairDiscovery, connections, quoteStore) {
        this.discovery = pairDiscovery;
        this.connections = connections;
        this.quotes = quoteStore;
    }

    execute() {
        return Object.fromEntries(this.discovery.getExchangeNames().map(exchangeName => [exchangeName, {
            ...this.connections.getStatus(exchangeName),
            quotes: this.quotes.getExchangeData(exchangeName).length
        }]));
    }
}

export default GetMarketStatusUseCase;