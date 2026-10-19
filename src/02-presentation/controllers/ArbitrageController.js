class ArbitrageController {

    constructor({ startMarketData, stopMarketData, getOpportunities, getMarketStatus, refreshTransferStatus, renderConsole }) {
        this.startMarketData = startMarketData;
        this.stopMarketData = stopMarketData;
        this.getOpportunities = getOpportunities;
        this.getMarketStatus = getMarketStatus;
        this.refreshTransferStatus = refreshTransferStatus;
        this.renderConsole = renderConsole;
    }

    start() {
        this.startMarketData.execute();
        this.refreshTransferStatus.execute();
    }

    render() {
        this.renderConsole(this.getOpportunities.execute(), this.getMarketStatus.execute());
    }

    stop() {
        this.refreshTransferStatus.stop();
        this.stopMarketData.execute();
    }
}

export default ArbitrageController;