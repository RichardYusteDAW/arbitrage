import normalizeAssets from '../../../01-common/normalizeAssets.js';
import { ExchangePair } from '../../models/exchange.js';
import { TickerData } from '../../models/ticker.js';

const cryptocomAdapter = {
    async discover(config, request) {
        const response = await request(config.pairsUrl);

        if (response.code !== 0 || !Array.isArray(response.result?.data))
            throw new Error('Crypto.com discovery failed');

        return response.result.data.filter(market => market.inst_type === 'CCY_PAIR'
            && market.tradable === true && market.product_type === 'DIGITAL_CURRENCIES').flatMap(market => {
            const assets = normalizeAssets('cryptocom', market.base_ccy, market.quote_ccy);
            return assets ? [new ExchangePair({ id: market.symbol, ...assets })] : [];
        });
    },

    async prepareConnection() {
        return { subscriptionDelay: 1000 };
    },

    subscriptions(pairs) {
        return [{ id: 1, method: 'subscribe', nonce: Date.now(),
            params: { channels: pairs.map(pair => 'ticker.' + pair.id) } }];
    },

    respondToMessage(message) {
        if (message.method === 'public/heartbeat')
            return { id: message.id, method: 'public/respond-heartbeat' };
    },

    createParser(pairs) {
        const markets = new Map(pairs.map(pair => [pair.id, pair]));
        return message => {
            if (message.code !== undefined && message.code !== 0)
                throw new Error(message.message || 'Crypto.com subscription failed');

            if (message.result?.channel !== 'ticker')
                return [];

            const pair = markets.get(message.result.instrument_name);

            if (!pair)
                return [];

            return message.result.data.map(ticker => new TickerData({ symbol: pair.symbol, baseAsset: pair.baseAsset,
                bidPrice: Number(ticker.b), bidQty: Number(ticker.bs),
                askPrice: Number(ticker.k), askQty: Number(ticker.ks) }));
        };
    }
};

export default cryptocomAdapter;
