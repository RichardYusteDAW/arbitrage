class Opportunity {
    
    constructor({ symbol, buy, sell, profitability, maxVolumeUSD, profitUSD, withdraw = null }) {
        this.symbol = symbol;
        this.buy = buy;
        this.sell = sell;
        this.profitability = profitability;
        this.maxVolumeUSD = maxVolumeUSD;
        this.profitUSD = profitUSD;
        this.withdraw = withdraw;
    }
}

export { Opportunity };