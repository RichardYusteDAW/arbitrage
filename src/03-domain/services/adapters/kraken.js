import transferNetworks from '../../../01-common/transferNetworks.js';
import OrderBookService from '../orderBookService.js';
import { createHash, createHmac } from 'node:crypto';
import normalizeAssets from '../../../01-common/normalizeAssets.js';
import ASSET_EXCEPTIONS from '../../../01-common/assetExceptions.js';
import { ExchangePair } from '../../models/exchange.js';
import { TickerData } from '../../models/ticker.js';

let lastNonce = 0n;

const krakenAdapter = {

    async discover(config, request) {

        const data = await request(config.pairsUrl);

        if (data.error?.length)
            throw new Error(data.error.join(', '));

        return Object.values(data.result)
            .filter(pair => pair.status === 'online' && pair.wsname)
            .flatMap(pair => {
                const [base, quote] = pair.wsname.split('/');
                const assets = normalizeAssets('kraken', base, quote);

                if (!assets)
                    return [];

                const subscriptionAliases = ASSET_EXCEPTIONS.kraken.subscriptionAliases;
                const id = [base, quote].map(asset => subscriptionAliases[asset] ?? asset).join('/');
                return [new ExchangePair({ id, ...assets })];
            });
    },

    async getTransferStatuses(request, { apiKey, apiSecret } = {}) {
        if (!apiKey || !apiSecret)
            return [];

        const methods = new Map();
        const getAvailableAssets = async direction => {
            const available = new Set();
            const cursors = new Set();
            let cursor;

            do {
                const timestamp = BigInt(Date.now()) * 1000n;
                lastNonce = timestamp > lastNonce ? timestamp : lastNonce + 1n;
                const nonce = String(lastNonce);
                const query = new URLSearchParams(cursor ? { cursor } : { limit: '10000' });
                const path = '/funding/v1/methods/' + direction + '?' + query;
                const digest = createHash('sha256').update(nonce).digest();
                const signature = createHmac('sha512', Buffer.from(apiSecret, 'base64'))
                    .update(path).update(digest).digest('base64');
                const funding = await request('https://api.kraken.com' + path, {
                    headers: { 'API-Key': apiKey, 'API-Nonce': nonce, 'API-Sign': signature }
                });

                if (!Array.isArray(funding.methods))
                    throw new Error('Kraken funding assets request failed');

                for (const method of funding.methods) {
                    if (method.asset?.class !== 'currency')
                        continue;

                    const assets = normalizeAssets('kraken', method.asset.name, '');

                    if (!assets)
                        continue;

                    available.add(assets.baseAsset);
                    const entries = methods.get(assets.baseAsset) ?? [];
                    entries.push({ name: method.network?.network_name, direction });
                    methods.set(assets.baseAsset, entries);
                }
                cursor = funding.next_cursor;

                if (cursor && cursors.has(cursor))
                    throw new Error('Kraken funding pagination repeated');

                cursors.add(cursor);
            } while (cursor);

            return available;
        };

        const availableWithdraw = await getAvailableAssets('withdraw');
        const availableDeposit = await getAvailableAssets('deposit');
        const response = await request('https://api.kraken.com/0/public/Assets');

        if (response.error?.length || !response.result)
            throw new Error('Kraken asset status request failed');

        return Object.values(response.result).flatMap(coin => {
            if (!coin.altname)
                return [];

            const assets = normalizeAssets('kraken', coin.altname, '');

            if (!assets)
                return [];

            let withdraw = null;

            if (['deposit_only', 'funding_temporarily_disabled', 'disabled'].includes(coin.status))
                withdraw = false;
            else if (['enabled', 'withdrawal_only'].includes(coin.status))
                withdraw = availableWithdraw.has(assets.baseAsset);

            let deposit = null;

            if (['withdrawal_only', 'funding_temporarily_disabled', 'disabled'].includes(coin.status))
                deposit = false;
            else if (['enabled', 'deposit_only'].includes(coin.status))
                deposit = availableDeposit.has(assets.baseAsset);

            const entries = methods.get(assets.baseAsset) ?? [];
            const names = [...new Set(entries.map(entry => entry.name).filter(Boolean))];
            return [{ asset: assets.baseAsset, withdraw, deposit,
                ...transferNetworks(names.map(name => ({ name,
                    withdraw: withdraw === null ? null : withdraw && entries.some(entry => entry.name === name && entry.direction === 'withdraw'),
                    deposit: deposit === null ? null : deposit && entries.some(entry => entry.name === name && entry.direction === 'deposit')
                }))) }];
        });
    },

    subscriptions(pairs) {
        return [{
            method: 'subscribe', params: {
                channel: 'book',
                symbol: pairs.map(pair => pair.id),
                depth: 25,
                snapshot: true
            }
        }];
    },

    createParser(pairs) {
        const pairsMap = new Map(pairs.map(pair => [pair.id, pair]));
        const books = new Map();
        return message => {

            if (message.success === false)
                throw new Error(message.error);

            if (message.channel !== 'book')
                return [];

            return message.data.flatMap(ticker => {
                const pair = pairsMap.get(ticker.symbol);
                if (!pair)
                    return [];

                if (message.type === 'snapshot')
                    books.set(pair.id, new OrderBookService());

                const book = books.get(pair.id);

                if (!book)
                    throw new Error('Kraken update before snapshot');

                book.apply([
                    ...(ticker.bids ?? []).map(level => ({ side: 'bid', price_level: level.price, new_quantity: level.qty })),
                    ...(ticker.asks ?? []).map(level => ({ side: 'ask', price_level: level.price, new_quantity: level.qty }))
                ]);
                book.trim(25);
                return [new TickerData({ symbol: pair.symbol, baseAsset: pair.baseAsset, ...book.getLevels() })];
            });
        };
    },
    heartbeat: () => ({ method: 'ping' })
};

export default krakenAdapter;