import OrderBookService from '../orderBookService.js';
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
        return [
            { action: 'subscribe', channels: [{ name: 'book', markets: pairs.map(pair => pair.id) }] },
            ...pairs.map((pair, index) => ({ action: 'getBook', market: pair.id, depth: 1000, requestId: index + 1 }))
        ];
    },

    createParser(pairs) {
        const markets = new Map(pairs.map(pair => [pair.id, pair]));
        const states = new Map(pairs.map(pair => [pair.id, { book: null, nonce: null, pending: [] }]));
        const apply = (state, update) => {
            if (update.nonce <= state.nonce)
                return;

            if (update.nonce !== state.nonce + 1)
                throw new Error('Bitvavo order book sequence gap');

            state.book.apply([
                ...update.bids.map(([price, quantity]) => ({ side: 'bid', price_level: price, new_quantity: quantity })),
                ...update.asks.map(([price, quantity]) => ({ side: 'ask', price_level: price, new_quantity: quantity }))
            ]);
            state.nonce = update.nonce;
        };
        return message => {
            if (message.errorCode !== undefined || message.error)
                throw new Error(message.error || 'Bitvavo subscription failed');

            const snapshot = message.action === 'getBook';

            if (!snapshot && message.event !== 'book')
                return [];

            const update = snapshot ? message.response : message;
            const pair = markets.get(update?.market);

            if (!pair)
                return [];

            const state = states.get(pair.id);

            if (snapshot) {
                state.book = new OrderBookService();
                state.book.apply([
                    ...update.bids.map(([price, quantity]) => ({ side: 'bid', price_level: price, new_quantity: quantity })),
                    ...update.asks.map(([price, quantity]) => ({ side: 'ask', price_level: price, new_quantity: quantity }))
                ]);
                state.nonce = update.nonce;

                for (const pending of state.pending)
                    apply(state, pending);

                state.pending = [];
            } else if (!state.book) {
                state.pending.push(update);

                if (state.pending.length > 1000)
                    throw new Error('Bitvavo order book snapshot timeout');

                return [];
            } else {
                apply(state, update);
            }

            return [new TickerData({ symbol: pair.symbol, baseAsset: pair.baseAsset, ...state.book.getLevels(50) })];
        };
    },

    heartbeat: () => ({ action: 'getTime' })
};

export default bitvavoAdapter;