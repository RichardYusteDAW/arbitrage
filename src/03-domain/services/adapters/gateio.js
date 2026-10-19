import { ExchangePair } from '../../models/exchange.js';
import { TickerData } from '../../models/ticker.js';

const gateioAdapter = {

    async discover(config, request) {
        const response = await request(config.pairsUrl);
        
        if (!Array.isArray(response)) 
            throw new Error(response.message || 'Gate.io discovery failed');

        return response
            .filter(pair => pair.trade_status === 'tradable' && pair.type !== 'premarket')
            .map(pair => new ExchangePair({
                id: pair.id,
                symbol: pair.base + pair.quote,
                baseAsset: pair.base
            }));
    },

    subscriptions(pairs) {
        return [{ time: Math.floor(Date.now() / 1000), channel: 'spot.book_ticker',
            event: 'subscribe', payload: pairs.map(pair => pair.id) }];
    },

    createParser(pairs) {
        const pairsMap = new Map(pairs.map(pair => [pair.id, pair]));
        return message => {

            if (message.error) 
                throw new Error(message.error.message || 'Gate.io subscription failed');

            if (message.channel !== 'spot.book_ticker' || message.event !== 'update') 
                return [];

            const ticker = message.result;
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
    },

    heartbeat: () => ({ time: Math.floor(Date.now() / 1000), channel: 'spot.ping' })
};

export default gateioAdapter;