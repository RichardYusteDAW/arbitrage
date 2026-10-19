class OrderBookService {

    constructor() {
        this.bids = new Map();
        this.asks = new Map();
    }

    reset() {
        this.bids.clear();
        this.asks.clear();
    }

    apply(updates) {
        for (const update of updates) {
            const side = update.side === 'bid' ? this.bids : this.asks;
            const price = Number(update.price_level);
            const quantity = Number(update.new_quantity);

            if (quantity === 0)
                side.delete(price);
            else
                side.set(price, quantity);
        }
    }

    getBestPrices() {
        let bidPrice = 0;
        let askPrice = Infinity;

        for (const price of this.bids.keys())

            if (price > bidPrice)
                bidPrice = price;

        for (const price of this.asks.keys())

            if (price < askPrice)
                askPrice = price;

        return {
            bidPrice,
            bidQty: this.bids.get(bidPrice) ?? 0,
            askPrice: Number.isFinite(askPrice) ? askPrice : 0,
            askQty: this.asks.get(askPrice) ?? 0
        };
    }

    getLevels(depth = Infinity) {
        return {
            bids: [...this.bids].sort((a, b) => b[0] - a[0]).slice(0, depth),
            asks: [...this.asks].sort((a, b) => a[0] - b[0]).slice(0, depth)
        };
    }

    trim(depth) {
        const { bids, asks } = this.getLevels(depth);
        this.bids = new Map(bids);
        this.asks = new Map(asks);
    }
}

export default OrderBookService;