class ArbitrageController {

    constructor({ startMarketData, stopMarketData, getOpportunities, getMarketStatus, refreshWithdrawalStatus, renderConsole }) {
        this.startMarketData = startMarketData;
        this.stopMarketData = stopMarketData;
        this.getOpportunities = getOpportunities;
        this.getMarketStatus = getMarketStatus;
        this.refreshWithdrawalStatus = refreshWithdrawalStatus;
        this.renderConsole = renderConsole;
    }

    start() {
        this.startMarketData.execute();
        this.refreshWithdrawalStatus.execute();
    }

    render() {
        this.renderConsole(this.getOpportunities.execute(), this.getMarketStatus.execute());
    }

    stop() {
        this.refreshWithdrawalStatus.stop();
        this.stopMarketData.execute();
    }
}

export default ArbitrageController;