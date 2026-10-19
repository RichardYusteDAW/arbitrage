import { ExchangePair } from '../../models/exchange.js';
import { TickerData } from '../../models/ticker.js';

const kucoinAdapter = {
    async discover(config, request) {
        const response = await request(config.pairsUrl);

        if (response.code !== '200000')
            throw new Error(response.msg || 'KuCoin discovery failed');

        return response.data.filter(pair => pair.enableTrading === true).map(pair => new ExchangePair({
            id: pair.symbol,
            symbol: pair.baseCurrency + pair.quoteCurrency,
            baseAsset: pair.baseCurrency
        }));
    },

    async prepareConnection(config, request) {
        const response = await request('https://api.kucoin.com/api/v1/bullet-public', { method: 'POST' });
        if (response.code !== '200000') 
            throw new Error(response.msg || 'KuCoin token request failed');

        const server = response.data.instanceServers.find(server => server.protocol === 'websocket' && server.encrypt);
        if (!server || !response.data.token || !(server.pingInterval > 0) || !(server.pingTimeout > 0))
            throw new Error('Invalid KuCoin WebSocket configuration');

        const url = new URL(server.endpoint);

        url.searchParams.set('token', response.data.token);
        url.searchParams.set('connectId', crypto.randomUUID());

        return { websocketUrl: url.toString(), heartbeatInterval: server.pingInterval, heartbeatTimeout: server.pingTimeout };
    },

    subscriptions(pairs) {
        return pairs.length ? [{
            id: crypto.randomUUID(), type: 'subscribe',
            topic: '/market/ticker:' + pairs.map(pair => pair.id).join(','), privateChannel: false, response: true
        }] : [];
    },

    createParser(pairs) {
        const pairsMap = new Map(pairs.map(pair => [pair.id, pair]));
        return message => {

            if (message.type === 'error') 
                throw new Error(message.data || 'KuCoin subscription failed');

            if (message.type !== 'message' || !message.topic?.startsWith('/market/ticker:')) 
                return [];

            const pair = pairsMap.get(message.topic.slice('/market/ticker:'.length));
            if (!pair) 
                return [];
            
            return [new TickerData({
                symbol: pair.symbol, baseAsset: pair.baseAsset,
                bidPrice: Number(message.data.bestBid), bidQty: Number(message.data.bestBidSize),
                askPrice: Number(message.data.bestAsk), askQty: Number(message.data.bestAskSize)
            })];
        };
    },

    heartbeat: () => ({ id: crypto.randomUUID(), type: 'ping' }),
    isPong: message => message.type === 'pong'
};

export default kucoinAdapter;