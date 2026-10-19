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

        const getAvailableAssets = async direction => {
            const timestamp = BigInt(Date.now()) * 1000n;
            lastNonce = timestamp > lastNonce ? timestamp : lastNonce + 1n;
            const nonce = String(lastNonce);
            const path = '/funding/v1/assets/' + direction + '?asset_class=currency';
            const digest = createHash('sha256').update(nonce).digest();
            const signature = createHmac('sha512', Buffer.from(apiSecret, 'base64'))
                .update(path).update(digest).digest('base64');
            const funding = await request('https://api.kraken.com' + path, {
                headers: { 'API-Key': apiKey, 'API-Nonce': nonce, 'API-Sign': signature }
            });

            if (!Array.isArray(funding.currency))
                throw new Error('Kraken funding assets request failed');

            return new Set(funding.currency.flatMap(coin => {
                const assets = normalizeAssets('kraken', coin.name, '');

                return assets ? [assets.baseAsset] : [];
            }));
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

            return [{ asset: assets.baseAsset, withdraw, deposit }];
        });
    },

    subscriptions(pairs) {
        return [{
            method: 'subscribe', params: {
                channel: 'ticker',
                symbol: pairs.map(pair => pair.id),
                event_trigger: 'bbo',
                snapshot: true
            }
        }];
    },

    createParser(pairs) {
        const pairsMap = new Map(pairs.map(pair => [pair.id, pair]));
        return message => {

            if (message.success === false)
                throw new Error(message.error);

            if (message.channel !== 'ticker')
                return [];

            return message.data.flatMap(ticker => {
                const pair = pairsMap.get(ticker.symbol);
                return pair ? [new TickerData(
                    {
                        symbol: pair.symbol,
                        baseAsset: pair.baseAsset,
                        bidPrice: Number(ticker.bid),
                        bidQty: Number(ticker.bid_qty),
                        askPrice: Number(ticker.ask),
                        askQty: Number(ticker.ask_qty)
                    }
                )] : [];
            });
        };
    },
    heartbeat: () => ({ method: 'ping' })
};

export default krakenAdapter;