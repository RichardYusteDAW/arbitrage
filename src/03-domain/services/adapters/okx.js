import normalizeAssets from '../../../01-common/normalizeAssets.js';
import { ExchangePair } from '../../models/exchange.js';
import { TickerData } from '../../models/ticker.js';

const okxAdapter = {
    async discover(config, request) {
        const response = await request(config.pairsUrl);
        if (response.code !== '0') 
            throw new Error(response.msg || 'OKX discovery failed');

        return response.data
            .filter(pair => pair.instType === 'SPOT' && pair.state === 'live' && pair.instCategory !== '3')
            .flatMap(pair => {
                const assets = normalizeAssets('okx', pair.baseCcy, pair.quoteCcy);
                return assets ? [new ExchangePair({ id: pair.instId, ...assets })] : [];
            });
    },

    subscriptions(pairs) {
        return [{ op: 'subscribe', args: pairs.map(pair => ({ channel: 'tickers', instId: pair.id })) }];
    },

    decodeMessage(text) {
        return text === 'pong' ? null : JSON.parse(text);
    },

    createParser(pairs) {
        const pairsMap = new Map(pairs.map(pair => [pair.id, pair]));
        return message => {

            if (message.event === 'error' || (message.code !== undefined && message.code !== '0'))
                throw new Error(message.msg || 'OKX subscription failed');

            if (message.arg?.channel !== 'tickers' || !message.data) 
                return [];
            
            return message.data.flatMap(ticker => {
                const pair = pairsMap.get(ticker.instId);
                return pair ? [new TickerData({
                    symbol: pair.symbol,
                    baseAsset: pair.baseAsset,
                    bidPrice: Number(ticker.bidPx),
                    bidQty: Number(ticker.bidSz),
                    askPrice: Number(ticker.askPx),
                    askQty: Number(ticker.askSz)
                })] : [];
            });
        };
    },

    heartbeat: () => 'ping'
};

export default okxAdapter;