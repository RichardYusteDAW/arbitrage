/**
 * @param {import('../models/ticker.js').TickerInput[]} tickers
 * @param {{ symbol: string, status: string, baseAsset: string }[]} pairs
 * @returns {import('../models/ticker.js').TickerInput[]}
 */
const getBinanceData = (tickers, pairs) => {
    const pairsMap = new Map(
        pairs
            .filter(pair => pair.status === 'TRADING')
            .map(pair => [pair.symbol, pair])
    );

    return tickers
        .filter(ticker => pairsMap.has(ticker.symbol))
        .map(ticker => ({
            ...ticker,
            baseAsset: pairsMap.get(ticker.symbol).baseAsset
        }));
};

export { getBinanceData };
