class TickerData {

    constructor({ symbol, baseAsset, bidPrice, bidQty, askPrice, askQty, bids, asks, receivedAt }) {
        this.symbol = symbol;
        this.baseAsset = baseAsset;
        this.bidPrice = bidPrice;
        this.bidQty = bidQty;
        this.askPrice = askPrice;
        this.askQty = askQty;

        if (bids !== undefined) {
            this.bids = bids.map(([price, quantity]) => [Number(price), Number(quantity)])
                .sort((a, b) => b[0] - a[0]);
            [this.bidPrice, this.bidQty] = this.bids[0] ?? [0, 0];
        }

        if (asks !== undefined) {
            this.asks = asks.map(([price, quantity]) => [Number(price), Number(quantity)])
                .sort((a, b) => a[0] - b[0]);
            [this.askPrice, this.askQty] = this.asks[0] ?? [0, 0];
        }

        if (receivedAt !== undefined)
            this.receivedAt = receivedAt;
    }
}

export { TickerData };