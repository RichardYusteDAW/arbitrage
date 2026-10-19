import ASSET_EXCEPTIONS from './assetExceptions.js';

const normalizeAssets = (exchange, base, quote) => {

    const { aliases = {}, excludedAssets = [] } = ASSET_EXCEPTIONS[exchange] ?? {};

    if (excludedAssets.includes(base) || excludedAssets.includes(quote)) 
        return null;

    const baseAsset = aliases[base] ?? base;
    const quoteAsset = aliases[quote] ?? quote;
    
    return { symbol: baseAsset + quoteAsset, baseAsset };
};

export default normalizeAssets;