/**
 * @param {number|string} buyPrice
 * @param {number|string} sellPrice
 * @returns {number|null} Porcentaje de rentabilidad bruta.
 */
const calculateProfitability = (buyPrice, sellPrice) => {
    buyPrice = Number(buyPrice);
    sellPrice = Number(sellPrice);

    const isFinite = Number.isFinite(buyPrice) && Number.isFinite(sellPrice);
    const isPositive = buyPrice > 0 && sellPrice > 0;

    if (isFinite && isPositive)
        return (((sellPrice - buyPrice) / buyPrice) * 100);

    return null;
};

/**
 * @param {string|undefined} baseAsset
 * @param {number|string|null} askQty
 * @param {number|string|null} bidQty
 * @param {Map<string, import('../models/ticker.js').TickerInput>} market
 * @returns {number|null}
 */
const calculateMaxVolume = (baseAsset, askQty, bidQty, market) => {
    const maxQty = Math.min(
        Number(askQty),
        Number(bidQty)
    );

    if (!Number.isFinite(maxQty) || maxQty <= 0) return null;

    for (const quote of ['USDT', 'USDC']) {
        const ticker = market.get(baseAsset + quote);
        if (!ticker) continue;

        const price = Number(ticker.askPrice);
        return Number.isFinite(price) && price > 0 ? maxQty * price : null;
    }

    return null;
}

/**
 * @param {import('../models/ticker.js').ExchangesData} exchangesData
 * @returns {import('../models/opportunity.js').Opportunity[]}
 */
const calculateOpportunities = (exchangesData) => {
    const exchangesMap = new Map(
        Object.entries(exchangesData).map(([exchangeName, tickersData]) => [
            exchangeName,
            new Map(tickersData.map(tickerData => [tickerData.symbol, tickerData]))
        ])
    );

    /** @type {import('../models/opportunity.js').Opportunity[]} */
    const opportunities = [];

    for (const [buyExchangeName, buyTickers] of exchangesMap) {
        for (const [sellExchangeName, sellTickers] of exchangesMap) {
            if (buyExchangeName === sellExchangeName) continue;

            for (const [buyTickerSymbol, buyTickerData] of buyTickers) {
                
                if (!buyTickerSymbol) continue;

                const sellTickerData = sellTickers.get(buyTickerSymbol);
                if (!sellTickerData) continue;

                const profitability = calculateProfitability(buyTickerData.askPrice, sellTickerData.bidPrice);
                if (profitability > 0) {
                    const maxVolumeUSD = calculateMaxVolume(buyTickerData.baseAsset ?? sellTickerData.baseAsset, buyTickerData.askQty, sellTickerData.bidQty, buyTickers);
                    const opportunity = {
                        symbol: buyTickerSymbol,
                        buy: buyExchangeName,
                        sell: sellExchangeName,
                        profitability,
                        maxVolumeUSD,
                        profitUSD: maxVolumeUSD === null ? null : maxVolumeUSD * profitability / 100
                    };

                    opportunities.push(opportunity);
                }
            }
        }
    }

    return opportunities;
};

export { calculateOpportunities };
