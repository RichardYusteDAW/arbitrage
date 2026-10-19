class GetOpportunitiesUseCase {

    constructor(quoteStore, calculateOpportunities, transferStatus) {
        this.quoteStore = quoteStore;
        this.transferStatus = transferStatus;
        this.calculateOpportunities = calculateOpportunities;
    }

    execute() {
        const data = this.quoteStore.getData();
        const assets = new Map(Object.entries(data).map(([exchange, tickers]) =>
            [exchange, new Map(tickers.map(ticker => [ticker.symbol, ticker.baseAsset]))]));
        return this.calculateOpportunities(data).map(opportunity => {
            const asset = assets.get(opportunity.buy)?.get(opportunity.symbol);
            opportunity.withdraw = this.transferStatus.get(opportunity.buy, asset);
            opportunity.deposit = this.transferStatus.get(opportunity.sell, asset, 'deposit');
            return opportunity;
        }).filter(opportunity => opportunity.withdraw !== false && opportunity.deposit !== false
            && this.transferStatus.canTransfer(opportunity.buy, opportunity.sell,
                assets.get(opportunity.buy)?.get(opportunity.symbol)) !== false);
    }
}

export default GetOpportunitiesUseCase;