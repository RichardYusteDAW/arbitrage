import { ExchangePair } from '../../models/exchange.js';
import { TickerData } from '../../models/ticker.js';
import OrderBookService from '../orderBookService.js';

const coinbaseAdapter = {
    async discover(config, request) {
        const products = new Map();
        const cursors = new Set();
        let url = config.pairsUrl;

        while (url) {
            const data = await request(url);

            for (const product of data.products)
                products.set(product.product_id, product);

            url = null;

            if (data.pagination?.has_next) {
                const cursor = data.pagination.next_cursor;

                if (!cursor || cursors.has(cursor))
                    throw new Error('Invalid pagination cursor');

                cursors.add(cursor);

                const nextUrl = new URL(config.pairsUrl);
                nextUrl.searchParams.set('cursor', cursor);
                url = nextUrl.toString();
            }
        }

        // Public WS aliases most -USDC products to -USD; subscribe to the actual book once.
        const allProducts = [...products.values()];
        return allProducts
            .filter(product => product.product_type === 'SPOT'
                && product.status === 'online'
                && !product.trading_disabled
                && !product.is_disabled
                && !product.view_only
                && !product.cancel_only
                && !product.limit_only
                && !product.post_only)
            .filter(product => !product.alias || product.alias === product.product_id)
            .map(product => new ExchangePair({
                id: product.product_id,
                symbol: product.base_currency_id + product.quote_currency_id,
                baseAsset: product.base_currency_id
            }));
    },
    subscriptions(pairs) {
        return [
            { type: 'subscribe', channel: 'heartbeats' },
            { type: 'subscribe', channel: 'level2', product_ids: pairs.map(pair => pair.id) }
        ];
    },
    createParser(pairs) {
        const pairsMap = new Map(pairs.map(pair => [pair.id, pair]));
        const books = new Map();
        let lastSequence;
        return message => {
            if (message.type === 'error')
                throw new Error(message.message ?? 'Subscription failed');

            // The connection sequence also counts heartbeats and subscription messages.
            if (Number.isInteger(message.sequence_num)) {
                if (lastSequence !== undefined && message.sequence_num !== lastSequence + 1)
                    throw new Error('Order book sequence gap; new snapshot required');
                lastSequence = message.sequence_num;
            }

            if (message.channel !== 'l2_data')
                return [];

            const updates = [];

            for (const event of message.events) {
                const pair = pairsMap.get(event.product_id);

                if (!pair)
                    continue;

                if (event.type === 'snapshot')
                    books.set(event.product_id, new OrderBookService());

                const book = books.get(event.product_id);

                if (!book)
                    throw new Error('Order book update received before snapshot');

                book.apply(event.updates);
                updates.push(new TickerData({ symbol: pair.symbol, baseAsset: pair.baseAsset, ...book.getBestPrices() }));
            }
            return updates;
        };
    }
};

export default coinbaseAdapter;