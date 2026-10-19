import { Opportunity } from '../models/opportunity.js';

const calculateProfitability = (buyPrice, sellPrice) => {
    buyPrice = Number(buyPrice);
    sellPrice = Number(sellPrice);

    const isFinite = Number.isFinite(buyPrice) && Number.isFinite(sellPrice);
    const isPositive = buyPrice > 0 && sellPrice > 0;

    if (isFinite && isPositive)
        return (((sellPrice - buyPrice) / buyPrice) * 100);

    return null;
};

const calculateMaxVolume = (baseAsset, askQty, bidQty, market) => {
    const maxQty = Math.min(
        Number(askQty),
        Number(bidQty)
    );

    if (!Number.isFinite(maxQty) || maxQty <= 0) return null;

    for (const quote of ['USD', 'USDT', 'USDC']) {
        const ticker = market.get(baseAsset + quote);
        if (!ticker) continue;

        const price = Number(ticker.askPrice);
        return Number.isFinite(price) && price > 0 ? maxQty * price : null;
    }

    return null;
};

const createExchangeMaps = exchangesData => new Map(
    Object.entries(exchangesData).map(([exchangeName, tickersData]) => [
        exchangeName,
        new Map(tickersData.map(tickerData => [tickerData.symbol, tickerData]))
    ])
);

const calculateOpportunity = (buyExchangeName, sellExchangeName, buyTickerData, sellTickerData, buyTickers) => {
    const profitability = calculateProfitability(buyTickerData.askPrice, sellTickerData.bidPrice);
    if (!(profitability > 0)) return null;

    const maxVolumeUSD = calculateMaxVolume(
        buyTickerData.baseAsset ?? sellTickerData.baseAsset,
        buyTickerData.askQty,
        sellTickerData.bidQty,
        buyTickers
    );
    return new Opportunity({
        symbol: buyTickerData.symbol,
        buy: buyExchangeName,
        sell: sellExchangeName,
        profitability,
        maxVolumeUSD,
        profitUSD: maxVolumeUSD === null ? null : maxVolumeUSD * profitability / 100
    });
};

const calculateOpportunities = exchangesData => {
    const exchangesMap = createExchangeMaps(exchangesData);

    const opportunities = [];

    for (const [buyExchangeName, buyTickers] of exchangesMap) {
        for (const [sellExchangeName, sellTickers] of exchangesMap) {
            if (buyExchangeName === sellExchangeName) continue;

            for (const [buyTickerSymbol, buyTickerData] of buyTickers) {

                if (!buyTickerSymbol) continue;

                const sellTickerData = sellTickers.get(buyTickerSymbol);
                if (!sellTickerData) continue;

                const opportunity = calculateOpportunity(buyExchangeName, sellExchangeName, buyTickerData, sellTickerData, buyTickers);
                if (!opportunity) continue;
                opportunities.push(opportunity);
            }
        }
    }

    return opportunities;
};

export { calculateOpportunities };