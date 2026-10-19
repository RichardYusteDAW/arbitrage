class TickerData {

    constructor({ symbol, baseAsset, bidPrice, bidQty, askPrice, askQty, receivedAt }) {
        this.symbol = symbol;
        this.baseAsset = baseAsset;
        this.bidPrice = bidPrice;
        this.bidQty = bidQty;
        this.askPrice = askPrice;
        this.askQty = askQty;

        if (receivedAt !== undefined)
            this.receivedAt = receivedAt;
    }
}

export { TickerData };