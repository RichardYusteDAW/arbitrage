import { createHmac } from 'node:crypto';
import transferAvailability from '../../../01-common/transferAvailability.js';
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

    async getTransferStatuses(request, { apiKey, apiSecret } = {}) {
        if (!apiKey || !apiSecret)
            return [];

        const clock = await request('https://api.binance.com/api/v3/time');

        if (!Number.isFinite(clock.serverTime) || clock.serverTime <= 0)
            throw new Error('Invalid Binance server time');

        const query = new URLSearchParams({ timestamp: String(clock.serverTime), recvWindow: '5000' }).toString();
        const signature = createHmac('sha256', apiSecret).update(query).digest('hex');
        const response = await request('https://api.binance.com/sapi/v1/capital/config/getall?' + query + '&signature=' + signature, {
            headers: { 'X-MBX-APIKEY': apiKey }
        });

        if (!Array.isArray(response))
            throw new Error('Binance currencies request failed');

        return response.flatMap(coin => {
            const assets = normalizeAssets('binance', coin.coin, '');
            const withdraw = coin.withdrawAllEnable === false ? false
                : transferAvailability((coin.networkList ?? []).map(network => network.withdrawEnable));
            const deposit = coin.depositAllEnable === false ? false
                : transferAvailability((coin.networkList ?? []).map(network => network.depositEnable));

            return assets ? [{ asset: assets.baseAsset, withdraw, deposit }] : [];
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