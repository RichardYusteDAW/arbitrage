import { ExchangePair } from '../../models/exchange.js';
import { TickerData } from '../../models/ticker.js';

const binanceAdapter = {
    
    async discover(config, request) {

        const data = await request(config.pairsUrl);

        return data.symbols
            .filter(pair => pair.status === 'TRADING' && pair.isSpotTradingAllowed !== false)
            .map(pair => new ExchangePair({
                id: pair.symbol,
                symbol: pair.symbol,
                baseAsset: pair.baseAsset
            }));
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