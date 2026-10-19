import normalizeAssets from '../../../01-common/normalizeAssets.js';
import ASSET_EXCEPTIONS from '../../../01-common/assetExceptions.js';
import { ExchangePair } from '../../models/exchange.js';
import { TickerData } from '../../models/ticker.js';


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
                if (!assets) return [];
                const subscriptionAliases = ASSET_EXCEPTIONS.kraken.subscriptionAliases;
                const id = [base, quote].map(asset => subscriptionAliases[asset] ?? asset).join('/');
                return [new ExchangePair({ id, ...assets })];
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