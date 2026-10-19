import normalizeAssets from '../../../01-common/normalizeAssets.js';
import { ExchangePair } from '../../models/exchange.js';
import { TickerData } from '../../models/ticker.js';

const bybitAdapter = {

    async discover(config, request) {
        const response = await request(config.pairsUrl);
        if (response.retCode !== 0) 
            throw new Error(response.retMsg || 'Bybit discovery failed');

        return response.result.list
            .filter(pair => pair.status === 'Trading')
            .flatMap(pair => {
                const assets = normalizeAssets('bybit', pair.baseCoin, pair.quoteCoin);
                return assets ? [new ExchangePair({ id: pair.symbol, ...assets })] : [];
            });
    },

    subscriptions(pairs) {
        const messages = [];

        for (let index = 0; index < pairs.length; index += 10)
            messages.push({ op: 'subscribe', args: pairs.slice(index, index + 10).map(pair => 'orderbook.1.' + pair.id) });
        
        return messages;

    },

    createParser(pairs) {
        const pairsMap = new Map(pairs.map(pair => [pair.id, pair]));
        return message => {

            if (message.success === false || (message.retCode !== undefined && message.retCode !== 0))
                throw new Error(message.ret_msg || message.retMsg || 'Bybit subscription failed');

            if (!message.topic?.startsWith('orderbook.1.')) 
                return [];

            const pair = pairsMap.get(message.data.s);
            if (!pair || message.topic !== 'orderbook.1.' + pair.id) 
                return [];

            if (message.type !== 'snapshot') 
                throw new Error('Expected Bybit level 1 snapshot');

            const bid = message.data.b[0];
            const ask = message.data.a[0];
            
            return [new TickerData({
                symbol: pair.symbol,
                baseAsset: pair.baseAsset,
                bidPrice: Number(bid?.[0] ?? 0),
                bidQty: Number(bid?.[1] ?? 0),
                askPrice: Number(ask?.[0] ?? 0),
                askQty: Number(ask?.[1] ?? 0)
            })];
        };
    },

    heartbeat: () => ({ op: 'ping' })
};

export default bybitAdapter;