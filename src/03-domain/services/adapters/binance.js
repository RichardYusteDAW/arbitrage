import normalizeAssets from '../../../01-common/normalizeAssets.js';
import { ExchangePair } from '../../models/exchange.js';
import { TickerData } from '../../models/ticker.js';

const binanceAdapter = {
    
    async discover(config, request) {

        const data = await request(config.pairsUrl);

        return data.symbols
            .filter(pair => pair.status === 'TRADING' && pair.isSpotTradingAllowed !== false)
            .flatMap(pair => {
                const assets = normalizeAssets('binance', pair.baseAsset, pair.quoteAsset ?? pair.symbol.slice(pair.baseAsset.length));
                return assets ? [new ExchangePair({ id: pair.symbol, ...assets })] : [];
            });
    },
    subscriptions(pairs) {
        return [
            {
                method: 'SUBSCRIBE',
                params: pairs.map(pair => `${pair.id.toLowerCase()}@bookTicker`),
                id: 1
            }
        ];
    },
    createParser(pairs) {
        const pairsMap = new Map(pairs.map(pair => [pair.id, pair]));

        return message => {
            if (message.code !== undefined)
                throw new Error(message.msg);

            const ticker = message.data ?? message;
            const pair = pairsMap.get(ticker.s);
            if (!pair)
                return [];

            return [new TickerData({
                symbol: pair.symbol,
                baseAsset: pair.baseAsset,
                bidPrice: Number(ticker.b),
                bidQty: Number(ticker.B),
                askPrice: Number(ticker.a),
                askQty: Number(ticker.A)
            })];
        };
    }
};

export default binanceAdapter;