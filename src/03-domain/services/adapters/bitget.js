import transferNetworks from '../../../01-common/transferNetworks.js';
import transferAvailability from '../../../01-common/transferAvailability.js';
import normalizeAssets from '../../../01-common/normalizeAssets.js';
import { ExchangePair } from '../../models/exchange.js';
import { TickerData } from '../../models/ticker.js';

const bitgetAdapter = {

    async discover(config, request) {
        const response = await request(config.pairsUrl);

        if (response.code !== '00000')
            throw new Error(response.msg || 'Bitget discovery failed');

        return response.data
            .filter(pair => pair.category === 'SPOT' && pair.status === 'online')
            .flatMap(pair => {
                const assets = normalizeAssets('bitget', pair.baseCoin, pair.quoteCoin);
                return assets ? [new ExchangePair({ id: pair.symbol, ...assets })] : [];
            });
    },

    async getTransferStatuses(request) {
        const response = await request('https://api.bitget.com/api/v2/spot/public/coins');

        if (response.code !== '00000')
            throw new Error(response.msg || 'Bitget currencies failed');

        return response.data.flatMap(coin => {
            const assets = normalizeAssets('bitget', coin.coin, '');
            const chains = coin.chains ?? [];
            const networks = chains.map(chain => ({
                name: chain.chain,
                withdraw: chain.withdrawable === 'true' ? true : chain.withdrawable === 'false' ? false : null,
                deposit: chain.rechargeable === 'true' ? true : chain.rechargeable === 'false' ? false : null
            }));
            const withdraw = transferAvailability(networks.map(network => network.withdraw));
            const deposit = transferAvailability(networks.map(network => network.deposit));

            return assets ? [{ asset: assets.baseAsset, withdraw, deposit, ...transferNetworks(networks) }] : [];
        });
    },

    subscriptions(pairs) {
        return [{ op: 'subscribe', args: pairs.map(pair => ({ instType: 'spot', topic: 'books5', symbol: pair.id })) }];
    },

    decodeMessage(text) {
        return text === 'pong' ? null : JSON.parse(text);
    },

    createParser(pairs) {
        const pairsMap = new Map(pairs.map(pair => [pair.id, pair]));

        return message => {

            if (message.event === 'error' || (message.code !== undefined && message.code !== '00000'))
                throw new Error(message.msg || 'Bitget subscription failed');

            if (message.arg?.instType !== 'spot' || message.arg.topic !== 'books5' || !message.data)
                return [];

            const pair = pairsMap.get(message.arg.symbol);

            if (!pair)
                return [];

            return message.data.map(ticker => new TickerData({
                symbol: pair.symbol,
                baseAsset: pair.baseAsset,
                bids: ticker.b,
                asks: ticker.a
            }));
        };
    },

    heartbeat: () => 'ping'
};

export default bitgetAdapter;