class GetOpportunitiesUseCase {
    
    constructor(quoteStore, calculateOpportunities) {
        this.quoteStore = quoteStore;
        this.calculateOpportunities = calculateOpportunities;
    }

    execute() {
        return this.calculateOpportunities(this.quoteStore.getData());
    }
}

export default GetOpportunitiesUseCase;