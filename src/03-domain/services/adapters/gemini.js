import normalizeAssets from '../../../01-common/normalizeAssets.js';
import { ExchangePair } from '../../models/exchange.js';
import { TickerData } from '../../models/ticker.js';

const QUOTE_ASSETS = ['RLUSD', 'GUSD', 'USDC', 'USDT', 'USD', 'EUR', 'GBP', 'SGD', 'AUD', 'HKD', 'CAD', 'DAI', 'BTC', 'ETH'];

const geminiAdapter = {
    async discover(config, request) {
        const symbols = await request(config.pairsUrl);

        if (!Array.isArray(symbols))
            throw new Error('Gemini discovery failed');

        return symbols.flatMap(id => {
            const symbol = id.toUpperCase();
            const quote = QUOTE_ASSETS.find(asset => symbol.endsWith(asset) && symbol.length > asset.length);

            if (!quote || symbol.includes('PERP') || symbol.includes('-'))
                return [];

            const assets = normalizeAssets('gemini', symbol.slice(0, -quote.length), quote);
            return assets ? [new ExchangePair({ id, ...assets })] : [];
        });
    },

    subscriptions(pairs) {
        return [{ id: 1, method: 'subscribe', params: pairs.map(pair => pair.id + '@depth20@100ms') }];
    },

    createParser(pairs) {
        const markets = new Map(pairs.map(pair => [pair.id.toLowerCase(), pair]));
        return message => {
            if (message.error || message.status >= 400)
                throw new Error(message.error?.msg || 'Gemini subscription failed');

            const ticker = message.data ?? message;
            const id = message.stream?.split('@')[0] ?? ticker.symbol;
            const pair = markets.get(id?.toLowerCase());

            if (!pair)
                return [];

            return [new TickerData({ symbol: pair.symbol, baseAsset: pair.baseAsset,
                bids: ticker.bids, asks: ticker.asks })];
        };
    },

    heartbeat: () => ({ id: 'heartbeat', method: 'ping' })
};

export default geminiAdapter;