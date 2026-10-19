class Opportunity {

    constructor({ symbol, buy, sell, profitability, maxVolumeUSD, profitUSD, withdraw = null, deposit = null }) {
        this.symbol = symbol;
        this.buy = buy;
        this.sell = sell;
        this.profitability = profitability;
        this.maxVolumeUSD = maxVolumeUSD;
        this.profitUSD = profitUSD;
        this.withdraw = withdraw;
        this.deposit = deposit;
    }
}

export { Opportunity };