const CONVERSION_QUOTES = ['USDT', 'USDC'];

const selectPairs = catalogs => {
    const exchangeCountBySymbol = new Map();
    
    for (const pairs of Object.values(catalogs)) {
        for (const symbol of new Set(pairs.map(pair => pair.symbol)))
            exchangeCountBySymbol.set(symbol, (exchangeCountBySymbol.get(symbol) ?? 0) + 1);
    }

    const isShared = pair => exchangeCountBySymbol.get(pair.symbol) > 1;
    
    return Object.fromEntries(Object.entries(catalogs).map(([exchangeName, pairs]) => {
        const sharedBaseAssets = new Set(pairs.filter(isShared).map(pair => pair.baseAsset));
        const isConversionPair = pair => sharedBaseAssets.has(pair.baseAsset)
            && CONVERSION_QUOTES.some(quote => pair.symbol === pair.baseAsset + quote);

        return [exchangeName, pairs.filter(pair => isShared(pair) || isConversionPair(pair))];
    }));
};

export { selectPairs };