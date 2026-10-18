const getKrakenData = (krakenPairs, krakenResult) => {
    const ALIASES = {
        XBT: 'BTC',
        XDG: 'DOGE'
    };

    const krakenSymbols = new Map(
        Object.entries(krakenPairs)
            .filter(([symbol, pair]) => pair.status === 'online' && pair.wsname)
            .map(([symbol, pair]) => {
                const normalized = pair.wsname
                    .split('/')
                    .map(asset => ALIASES[asset] ?? asset);
    
                return [symbol, { symbol: normalized.join(''), baseAsset: normalized[0] }];
            })
    );

    return Object.entries(krakenResult)
        .filter(([symbol]) => krakenSymbols.has(symbol))
        .map(([symbol, ticker]) => ({
            symbol: krakenSymbols.get(symbol)?.symbol,
            baseAsset: krakenSymbols.get(symbol)?.baseAsset,
            bidPrice: Number(ticker.b[0]),
            bidQty: Number(ticker.b[1]),
            askPrice: Number(ticker.a[0]),
            askQty: Number(ticker.a[1])
        }));
};

export { getKrakenData };