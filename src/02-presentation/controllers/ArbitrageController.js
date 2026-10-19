class ArbitrageController {
    
    constructor({ startMarketData, stopMarketData, getOpportunities, getMarketStatus, renderConsole }) {
        this.startMarketData = startMarketData;
        this.stopMarketData = stopMarketData;
        this.getOpportunities = getOpportunities;
        this.getMarketStatus = getMarketStatus;
        this.renderConsole = renderConsole;
    }

    start() {
        this.startMarketData.execute();
    }

    render() {
        this.renderConsole(this.getOpportunities.execute(), this.getMarketStatus.execute());
    }

    stop() {
        this.stopMarketData.execute();
    }
}

export default ArbitrageController;