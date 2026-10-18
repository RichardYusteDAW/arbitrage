import { TickerData } from '../models/ticker.js';
import { TIMING } from '../data/settings.js';

class QuoteStore {
    constructor(exchangeNames, maxAge = TIMING.quoteMaxAge) {
        this.maxAge = maxAge;
        this.exchanges = new Map(exchangeNames.map(name => [name, new Map()]));
    }

    update(exchangeName, tickers) {
        const quotes = this.exchanges.get(exchangeName);
        
        for (const ticker of tickers) {
            const valid = [ticker.askPrice, ticker.bidPrice, ticker.askQty, ticker.bidQty]
                .every(value => Number.isFinite(value) && value > 0);
            
                if (!valid) {
                quotes.delete(ticker.symbol);
                continue;
            }

            quotes.set(ticker.symbol, new TickerData({ ...ticker, receivedAt: Date.now() }));
        }
    }

    remove(exchangeName, pairs) {
        const quotes = this.exchanges.get(exchangeName);

        for (const pair of pairs) 
            quotes.delete(pair.symbol);
    }

    clear() {
        for (const quotes of this.exchanges.values()) 
            quotes.clear();
    }

    getExchangeData(exchangeName) {
        const cutoff = Date.now() - this.maxAge;

        return [...this.exchanges.get(exchangeName).values()].filter(ticker => ticker.receivedAt >= cutoff);
    }

    getData() {
        return Object.fromEntries([...this.exchanges.keys()].map(name => [name, this.getExchangeData(name)]));
    }
}

export { QuoteStore };