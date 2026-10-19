import OrderBookService from '../orderBookService.js';
import transferAvailability from '../../../01-common/transferAvailability.js';
import normalizeAssets from '../../../01-common/normalizeAssets.js';
import { ExchangePair } from '../../models/exchange.js';
import { TickerData } from '../../models/ticker.js';

const API = 'https://api-pub.bitfinex.com/v2/conf/';
const enabled = status => status === 1 ? true : status === 0 ? false : null;
const assetName = (symbols, asset) => (symbols.get(asset) ?? asset).toUpperCase();

const bitfinexAdapter = {
    async discover(config, request) {
        const response = await request(config.pairsUrl);

        if (!Array.isArray(response?.[0]) || !Array.isArray(response[1]) || !Array.isArray(response[2]))
            throw new Error('Bitfinex discovery failed');

        const [pairs, mapping, securities] = response;
        const symbols = new Map(mapping);
        return pairs.filter(id => !id.includes('TEST') && !id.includes('F0') && !securities.includes(id)).flatMap(id => {
            const [base, quote] = id.includes(':') ? id.split(':') : [id.slice(0, 3), id.slice(3)];
            const assets = normalizeAssets('bitfinex', assetName(symbols, base), assetName(symbols, quote));
            return assets ? [new ExchangePair({ id: 't' + id, ...assets })] : [];
        });
    },

    async getTransferStatuses(request) {
        const response = await request(API + 'pub:map:tx:method,pub:info:tx:status,pub:map:currency:sym');

        if (!Array.isArray(response?.[0]) || !Array.isArray(response[1]) || !Array.isArray(response[2]))
            throw new Error('Bitfinex currencies failed');

        const [methods, statuses, mapping] = response;
        const symbols = new Map(mapping);
        const networks = new Map(statuses.map(([method, deposit, withdraw]) => [method,
            { deposit: enabled(deposit), withdraw: enabled(withdraw) }]));
        const currencies = new Map();

        for (const [method, coins] of methods) {
            for (const coin of coins) {
                const assets = normalizeAssets('bitfinex', assetName(symbols, coin), '');

                if (!assets || coin.includes('TEST'))
                    continue;

                const entries = currencies.get(assets.baseAsset) ?? [];
                entries.push(networks.get(method) ?? {});
                currencies.set(assets.baseAsset, entries);
            }
        }

        return [...currencies].map(([asset, entries]) => ({ asset,
            withdraw: transferAvailability(entries.map(entry => entry.withdraw)),
            deposit: transferAvailability(entries.map(entry => entry.deposit)) }));
    },

    subscriptions(pairs) {
        return pairs.map(pair => ({ event: 'subscribe', channel: 'book', symbol: pair.id, prec: 'P0', freq: 'F0', len: '25' }));
    },

    createParser(pairs) {
        const markets = new Map(pairs.map(pair => [pair.id, pair]));
        const channels = new Map();
        return message => {
            if (message.event === 'error' || (message.event === 'info' && [20051, 20060].includes(message.code)))
                throw new Error(message.msg || 'Bitfinex reconnect required');

            if (message.event === 'subscribed' && message.channel === 'book') {
                const pair = markets.get(message.symbol);

                if (pair)
                    channels.set(message.chanId, { pair, book: new OrderBookService(), snapshot: false });
            }

            if (!Array.isArray(message) || message[1] === 'hb')
                return [];

            const channel = channels.get(message[0]);

            if (!channel)
                return [];

            const snapshot = message[1].length === 0 || Array.isArray(message[1][0]);

            if (!snapshot && !channel.snapshot)
                throw new Error('Bitfinex update before snapshot');

            if (snapshot) {
                channel.book.reset();
                channel.snapshot = true;
            }

            const levels = snapshot ? message[1] : [message[1]];
            channel.book.apply(levels.map(([price, count, amount]) => ({
                side: amount > 0 ? 'bid' : 'ask', price_level: price,
                new_quantity: count > 0 ? Math.abs(amount) : 0
            })));
            channel.book.trim(25);
            return [new TickerData({ symbol: channel.pair.symbol, baseAsset: channel.pair.baseAsset,
                ...channel.book.getLevels() })];
        };
    },

    heartbeat: () => ({ event: 'ping', cid: Date.now() })
};

export default bitfinexAdapter;