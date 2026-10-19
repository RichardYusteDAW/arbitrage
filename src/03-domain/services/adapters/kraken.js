import { ExchangePair } from '../../models/exchange.js';
import { TickerData } from '../../models/ticker.js';

const ALIASES = { XBT: 'BTC', XDG: 'DOGE' };

const krakenAdapter = {
    
    async discover(config, request) {

        const data = await request(config.pairsUrl);

        if (data.error?.length)
            throw new Error(data.error.join(', '));

        return Object.values(data.result)
            .filter(pair => pair.status === 'online' && pair.wsname)
            .map(pair => {
                const assets = pair.wsname.split('/').map(asset => ALIASES[asset] ?? asset);
                return new ExchangePair(
                    {
                        id: assets.join('/'),
                        symbol: assets.join(''),
                        baseAsset: assets[0]
                    }
                );
            });
    },
    subscriptions(pairs) {
        return [{
            method: 'subscribe', params: {
                channel: 'ticker',
                symbol: pairs.map(pair => pair.id),
                event_trigger: 'bbo',
                snapshot: true
            }
        }];
    },
    createParser(pairs) {
        const pairsMap = new Map(pairs.map(pair => [pair.id, pair]));
        return message => {

            if (message.success === false)
                throw new Error(message.error);

            if (message.channel !== 'ticker')
                return [];

            return message.data.flatMap(ticker => {
                const pair = pairsMap.get(ticker.symbol);
                return pair ? [new TickerData(
                    {
                        symbol: pair.symbol,
                        baseAsset: pair.baseAsset,
                        bidPrice: Number(ticker.bid),
                        bidQty: Number(ticker.bid_qty),
                        askPrice: Number(ticker.ask),
                        askQty: Number(ticker.ask_qty)
                    }
                )] : [];
            });
        };
    },
    heartbeat: () => ({ method: 'ping' })
};

export default krakenAdapter;