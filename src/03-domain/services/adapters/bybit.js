import { createHmac } from 'node:crypto';
import withdrawalAvailability from '../../../01-common/withdrawalAvailability.js';
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

    async getWithdrawalStatuses(request, { apiKey, apiSecret } = {}) {
        if (!apiKey || !apiSecret)
            return [];

        const clock = await request('https://api.bybit.com/v5/market/time');

        if (clock.retCode !== 0 || !Number.isFinite(clock.time) || clock.time <= 0)
            throw new Error('Invalid Bybit server time');

        const timestamp = String(clock.time);
        const recvWindow = '5000';
        const signature = createHmac('sha256', apiSecret).update(timestamp + apiKey + recvWindow).digest('hex');
        const response = await request('https://api.bybit.com/v5/asset/coin/query-info', {
            headers: {
                'X-BAPI-API-KEY': apiKey,
                'X-BAPI-TIMESTAMP': timestamp,
                'X-BAPI-RECV-WINDOW': recvWindow,
                'X-BAPI-SIGN': signature
            }
        });

        if (response.retCode !== 0 || !Array.isArray(response.result?.rows)) {
            const error = new Error('Bybit currencies request failed');
            error.apiCode = response.retCode;
            throw error;
        }
        return response.result.rows.flatMap(coin => {
            const assets = normalizeAssets('bybit', coin.coin, '');
            const withdraw = withdrawalAvailability((coin.chains ?? []).map(chain =>
                chain.withdrawFee === '' || chain.chainWithdraw === '0' ? false
                    : chain.chainWithdraw === '1' ? true : null));
            return assets ? [{ asset: assets.baseAsset, withdraw }] : [];
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