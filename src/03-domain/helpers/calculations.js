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

const matchOrderBooks = (buy, sell) => {
    const asks = buy.asks ?? [[buy.askPrice, buy.askQty]];
    const bids = sell.bids ?? [[sell.bidPrice, sell.bidQty]];
    const valid = [...asks, ...bids].every(level => level.every(value => Number.isFinite(Number(value)) && Number(value) > 0));

    if (!valid)
        return null;

    let askIndex = 0;
    let bidIndex = 0;
    let askRemaining = Number(asks[0]?.[1] ?? 0);
    let bidRemaining = Number(bids[0]?.[1] ?? 0);
    let quantity = 0;
    let cost = 0;
    let revenue = 0;

    while (askIndex < asks.length && bidIndex < bids.length) {
        const askPrice = Number(asks[askIndex][0]);
        const bidPrice = Number(bids[bidIndex][0]);

        if (bidPrice <= askPrice)
            break;

        const amount = Math.min(askRemaining, bidRemaining);
        quantity += amount;
        cost += amount * askPrice;
        revenue += amount * bidPrice;
        askRemaining -= amount;
        bidRemaining -= amount;

        if (askRemaining <= 0)
            askRemaining = Number(asks[++askIndex]?.[1] ?? 0);

        if (bidRemaining <= 0)
            bidRemaining = Number(bids[++bidIndex]?.[1] ?? 0);
    }

    if (!(quantity > 0) || ![quantity, cost, revenue].every(Number.isFinite))
        return null;

    return { quantity, cost, revenue };
};

const getDollarRate = (ticker, baseAsset, market) => {
    const quoteAsset = ticker.symbol.slice(baseAsset.length);

    if (['USD', 'USDT', 'USDC'].includes(quoteAsset))
        return 1;

    for (const quote of ['USD', 'USDT', 'USDC']) {
        const direct = market.get(quoteAsset + quote);
        const base = market.get(baseAsset + quote);
        const rate = direct ? Number(direct.askPrice) : base ? Number(base.askPrice) / Number(ticker.askPrice) : null;

        if (direct || base)
            return Number.isFinite(rate) && rate > 0 ? rate : null;
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

    if (!(profitability > 0))
        return null;

    const execution = matchOrderBooks(buyTickerData, sellTickerData);
    const baseAsset = buyTickerData.baseAsset ?? sellTickerData.baseAsset;
    const dollarRate = getDollarRate(buyTickerData, baseAsset, buyTickers);
    const maxVolumeUSD = execution && dollarRate !== null ? execution.cost * dollarRate : null;
    const profitUSD = execution && dollarRate !== null ? (execution.revenue - execution.cost) * dollarRate : null;
    return new Opportunity({
        symbol: buyTickerData.symbol,
        buy: buyExchangeName,
        sell: sellExchangeName,
        profitability: execution ? calculateProfitability(execution.cost, execution.revenue) : profitability,
        quantity: execution?.quantity ?? null,
        maxVolumeUSD,
        profitUSD
    });
};

const calculateOpportunities = exchangesData => {
    const exchangesMap = createExchangeMaps(exchangesData);

    const opportunities = [];

    for (const [buyExchangeName, buyTickers] of exchangesMap) {
        for (const [sellExchangeName, sellTickers] of exchangesMap) {
            if (buyExchangeName === sellExchangeName)
                continue;

            for (const [buyTickerSymbol, buyTickerData] of buyTickers) {

                if (!buyTickerSymbol)
                    continue;

                const sellTickerData = sellTickers.get(buyTickerSymbol);

                if (!sellTickerData)
                    continue;

                const opportunity = calculateOpportunity(buyExchangeName, sellExchangeName, buyTickerData, sellTickerData, buyTickers);

                if (!opportunity)
                    continue;

                opportunities.push(opportunity);
            }
        }
    }

    return opportunities;
};

export { calculateOpportunities };