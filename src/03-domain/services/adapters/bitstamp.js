import transferNetworks from '../../../01-common/transferNetworks.js';
import transferAvailability from '../../../01-common/transferAvailability.js';
import normalizeAssets from '../../../01-common/normalizeAssets.js';
import { ExchangePair } from '../../models/exchange.js';
import { TickerData } from '../../models/ticker.js';

const enabled = status => status === 'Enabled' ? true : status === 'Disabled' ? false : null;

const bitstampAdapter = {
    async discover(config, request) {
        const markets = await request(config.pairsUrl);

        if (!Array.isArray(markets))
            throw new Error('Bitstamp discovery failed');

        return markets.filter(market => market.market_type === 'SPOT' && market.trading === 'Enabled')
            .flatMap(market => {
                const assets = normalizeAssets('bitstamp', market.base_currency, market.counter_currency);
                return assets ? [new ExchangePair({ id: market.market_symbol, ...assets })] : [];
            });
    },

    async getTransferStatuses(request) {
        const currencies = await request('https://www.bitstamp.net/api/v2/currencies/');

        if (!Array.isArray(currencies))
            throw new Error('Bitstamp currencies failed');

        return currencies.filter(coin => coin.type === 'crypto').flatMap(coin => {
            const assets = normalizeAssets('bitstamp', coin.currency, '');
            const networks = coin.networks?.length ? coin.networks : [coin];
            return assets ? [{ asset: assets.baseAsset,
                ...transferNetworks(networks.map(network => ({ name: network.network, withdraw: enabled(network.withdrawal), deposit: enabled(network.deposit) }))),
                withdraw: coin.withdrawal === 'Disabled' ? false : transferAvailability(networks.map(network => enabled(network.withdrawal))),
                deposit: coin.deposit === 'Disabled' ? false : transferAvailability(networks.map(network => enabled(network.deposit))) }] : [];
        });
    },

    subscriptions(pairs) {
        return pairs.map(pair => ({ event: 'bts:subscribe', data: { channel: 'order_book_' + pair.id } }));
    },

    createParser(pairs) {
        const channels = new Map(pairs.map(pair => ['order_book_' + pair.id, pair]));
        return message => {
            if (message.event === 'bts:error' || message.event === 'bts:request_reconnect')
                throw new Error(message.data?.message || 'Bitstamp reconnect required');

            const pair = channels.get(message.channel);

            if (message.event !== 'data' || !pair)
                return [];

            return [new TickerData({ symbol: pair.symbol, baseAsset: pair.baseAsset,
                bids: message.data.bids, asks: message.data.asks })];
        };
    }
};

export default bitstampAdapter;