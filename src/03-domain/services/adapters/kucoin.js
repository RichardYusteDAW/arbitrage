import transferAvailability from '../../../01-common/transferAvailability.js';
import normalizeAssets from '../../../01-common/normalizeAssets.js';
import { ExchangePair } from '../../models/exchange.js';
import { TickerData } from '../../models/ticker.js';

const kucoinAdapter = {
    async discover(config, request) {
        const response = await request(config.pairsUrl);

        if (response.code !== '200000')
            throw new Error(response.msg || 'KuCoin discovery failed');

        return response.data.filter(pair => pair.enableTrading === true).flatMap(pair => {
                const assets = normalizeAssets('kucoin', pair.baseCurrency, pair.quoteCurrency);
                return assets ? [new ExchangePair({ id: pair.symbol, ...assets })] : [];
            });
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

    async getTransferStatuses(request) {
        const response = await request('https://api.kucoin.com/api/v3/currencies');

        if (response.code !== '200000')
            throw new Error(response.msg || 'KuCoin currencies failed');

        return response.data.flatMap(coin => {
            const assets = normalizeAssets('kucoin', coin.currency, '');
            return assets ? [{ asset: assets.baseAsset,
                withdraw: transferAvailability((coin.chains ?? []).map(chain => chain.isWithdrawEnabled)),
                deposit: transferAvailability((coin.chains ?? []).map(chain => chain.isDepositEnabled)) }] : [];
        });
    },

    subscriptions(pairs) {
        return pairs.length ? [{
            id: crypto.randomUUID(), type: 'subscribe',
            topic: '/spotMarket/level2Depth50:' + pairs.map(pair => pair.id).join(','), privateChannel: false, response: true
        }] : [];
    },

    createParser(pairs) {
        const pairsMap = new Map(pairs.map(pair => [pair.id, pair]));
        return message => {

            if (message.type === 'error')
                throw new Error(message.data || 'KuCoin subscription failed');

            if (message.type !== 'message' || !message.topic?.startsWith('/spotMarket/level2Depth50:'))
                return [];

            const pair = pairsMap.get(message.topic.slice('/spotMarket/level2Depth50:'.length));

            if (!pair)
                return [];

            return [new TickerData({
                symbol: pair.symbol, baseAsset: pair.baseAsset,
                bids: message.data.bids, asks: message.data.asks
            })];
        };
    },

    heartbeat: () => ({ id: crypto.randomUUID(), type: 'ping' }),
    isPong: message => message.type === 'pong'
};

export default kucoinAdapter;