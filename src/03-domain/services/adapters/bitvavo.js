import normalizeAssets from '../../../01-common/normalizeAssets.js';
import { ExchangePair } from '../../models/exchange.js';
import { TickerData } from '../../models/ticker.js';

const enabled = status => status === 'OK' ? true : ['MAINTENANCE', 'DELISTED'].includes(status) ? false : null;

const bitvavoAdapter = {
    async discover(config, request) {
        const markets = await request(config.pairsUrl);

        if (!Array.isArray(markets))
            throw new Error('Bitvavo discovery failed');

        return markets.filter(market => market.status === 'trading').flatMap(market => {
            const assets = normalizeAssets('bitvavo', market.base, market.quote);
            return assets ? [new ExchangePair({ id: market.market, ...assets })] : [];
        });
    },

    async getTransferStatuses(request) {
        const currencies = await request('https://api.bitvavo.com/v2/assets');

        if (!Array.isArray(currencies))
            throw new Error('Bitvavo currencies failed');

        return currencies.flatMap(coin => {
            const assets = normalizeAssets('bitvavo', coin.symbol, '');
            return assets ? [{ asset: assets.baseAsset,
                withdraw: enabled(coin.withdrawalStatus), deposit: enabled(coin.depositStatus) }] : [];
        });
    },

    subscriptions(pairs) {
        return [{ action: 'subscribe', channels: [{ name: 'ticker24h', markets: pairs.map(pair => pair.id) }] }];
    },

    createParser(pairs) {
        const markets = new Map(pairs.map(pair => [pair.id, pair]));
        return message => {
            if (message.errorCode !== undefined || message.error)
                throw new Error(message.error || 'Bitvavo subscription failed');

            if (message.event !== 'ticker24h')
                return [];

            const tickers = Array.isArray(message.data) ? message.data : [message.data];
            return tickers.flatMap(ticker => {
                const pair = markets.get(ticker.market);
                return pair ? [new TickerData({ symbol: pair.symbol, baseAsset: pair.baseAsset,
                    bidPrice: Number(ticker.bid), bidQty: Number(ticker.bidSize),
                    askPrice: Number(ticker.ask), askQty: Number(ticker.askSize) })] : [];
            });
        };
    },

    heartbeat: () => ({ action: 'getTime' })
};

export default bitvavoAdapter;
