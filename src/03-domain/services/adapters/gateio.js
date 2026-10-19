import transferAvailability from '../../../01-common/transferAvailability.js';
import normalizeAssets from '../../../01-common/normalizeAssets.js';
import { ExchangePair } from '../../models/exchange.js';
import { TickerData } from '../../models/ticker.js';

const gateioAdapter = {

    async discover(config, request) {
        const response = await request(config.pairsUrl);

        if (!Array.isArray(response))
            throw new Error(response.message || 'Gate.io discovery failed');

        return response
            .filter(pair => pair.trade_status === 'tradable' && pair.type !== 'premarket')
            .flatMap(pair => {
                const assets = normalizeAssets('gateio', pair.base, pair.quote);
                return assets ? [new ExchangePair({ id: pair.id, ...assets })] : [];
            });
    },

    async getTransferStatuses(request) {
        const response = await request('https://api.gateio.ws/api/v4/spot/currencies');

        if (!Array.isArray(response))
            throw new Error(response.message || 'Gate.io currencies failed');

        return response.flatMap(coin => {
            const assets = normalizeAssets('gateio', coin.currency, '');
            const chains = coin.chains?.length ? coin.chains : [coin];
            const withdraw = transferAvailability(chains.map(chain =>
                chain.withdraw_disabled === true || chain.withdraw_delayed === true ? false
                    : chain.withdraw_disabled === false ? true : null));
            const deposit = transferAvailability(chains.map(chain =>
                chain.deposit_disabled === true ? false : chain.deposit_disabled === false ? true : null));

            return assets ? [{ asset: assets.baseAsset, withdraw, deposit }] : [];
        });
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