class Opportunity {
    constructor({ symbol, buy, sell, profitability, maxVolumeUSD, profitUSD }) {
        this.symbol = symbol;
        this.buy = buy;
        this.sell = sell;
        this.profitability = profitability;
        this.maxVolumeUSD = maxVolumeUSD;
        this.profitUSD = profitUSD;
    }
}

export { Opportunity };