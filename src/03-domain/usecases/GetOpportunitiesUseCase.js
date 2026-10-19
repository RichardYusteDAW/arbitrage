class GetOpportunitiesUseCase {

    constructor(quoteStore, calculateOpportunities, withdrawalStatus) {
        this.quoteStore = quoteStore;
        this.withdrawalStatus = withdrawalStatus;
        this.calculateOpportunities = calculateOpportunities;
    }

    execute() {
        const data = this.quoteStore.getData();
        const assets = new Map(Object.entries(data).map(([exchange, tickers]) =>
            [exchange, new Map(tickers.map(ticker => [ticker.symbol, ticker.baseAsset]))]));
        return this.calculateOpportunities(data).map(opportunity => {
            const asset = assets.get(opportunity.buy)?.get(opportunity.symbol);
            opportunity.withdraw = this.withdrawalStatus.get(opportunity.buy, asset);
            return opportunity;
        });
    }
}

export default GetOpportunitiesUseCase;