import { createHmac } from 'node:crypto';
import transferAvailability from '../../../01-common/transferAvailability.js';
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

    async getTransferStatuses(request, { apiKey, apiSecret, passphrase, apiBaseUrl = 'https://www.okx.com' } = {}) {
        if (!apiKey || !apiSecret || !passphrase)
            return [];

        const allowedDomains = ['https://www.okx.com', 'https://openapi.okx.com', 'https://eea.okx.com', 'https://us.okx.com', 'https://tr.okx.com'];

        if (!allowedDomains.includes(apiBaseUrl))
            throw new Error('Invalid OKX API domain');

        const clock = await request(apiBaseUrl + '/api/v5/public/time');
        const serverTime = Number(clock.data?.[0]?.ts);

        if (clock.code !== '0' || !Number.isFinite(serverTime) || serverTime <= 0)
            throw new Error('Invalid OKX server time');

        const timestamp = new Date(serverTime).toISOString();
        const path = '/api/v5/asset/currencies';
        const signature = createHmac('sha256', apiSecret).update(timestamp + 'GET' + path).digest('base64');
        const response = await request(apiBaseUrl + path, {
            headers: {
                'OK-ACCESS-KEY': apiKey,
                'OK-ACCESS-SIGN': signature,
                'OK-ACCESS-TIMESTAMP': timestamp,
                'OK-ACCESS-PASSPHRASE': passphrase,
                'Content-Type': 'application/json'
            }
        });

        if (response.code !== '0' || !Array.isArray(response.data)) {
            const error = new Error('OKX currencies request failed');
            error.apiCode = response.code;
            throw error;
        }

        const networksByAsset = new Map();

        for (const coin of response.data) {
            const assets = normalizeAssets('okx', coin.ccy, '');

            if (!assets)
                continue;

            const networks = networksByAsset.get(assets.baseAsset) ?? [];
            networks.push({ withdraw: coin.canWd, deposit: coin.canDep });
            networksByAsset.set(assets.baseAsset, networks);
        }

        return [...networksByAsset].map(([asset, states]) => ({
            asset,
            withdraw: transferAvailability(states.map(state => state.withdraw)),
            deposit: transferAvailability(states.map(state => state.deposit))
        }));
    },

    subscriptions(pairs) {
        return [{ op: 'subscribe', args: pairs.map(pair => ({ channel: 'books5', instId: pair.id })) }];
    },

    decodeMessage(text) {
        return text === 'pong' ? null : JSON.parse(text);
    },

    createParser(pairs) {
        const pairsMap = new Map(pairs.map(pair => [pair.id, pair]));
        return message => {

            if (message.event === 'error' || (message.code !== undefined && message.code !== '0'))
                throw new Error(message.msg || 'OKX subscription failed');

            if (message.arg?.channel !== 'books5' || !message.data)
                return [];

            return message.data.flatMap(ticker => {
                const pair = pairsMap.get(ticker.instId);
                return pair ? [new TickerData({
                    symbol: pair.symbol,
                    baseAsset: pair.baseAsset,
                    bids: ticker.bids,
                    asks: ticker.asks
                })] : [];
            });
        };
    },

    heartbeat: () => 'ping'
};

export default okxAdapter;