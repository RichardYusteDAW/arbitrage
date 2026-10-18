class ExchangePair {
    constructor({ id, symbol, baseAsset }) {
        this.id = id;
        this.symbol = symbol;
        this.baseAsset = baseAsset;
    }
}

class ExchangeConfig {
    constructor({ websocketUrl, pairsUrl, maxPairsPerConnection, adapter }) {
        this.websocketUrl = websocketUrl;
        this.pairsUrl = pairsUrl;
        this.maxPairsPerConnection = maxPairsPerConnection;
        this.adapter = adapter;
    }
}

export { ExchangePair, ExchangeConfig };