const KRAKEN_WEBSOCKET_ALIASES = { XBT: 'BTC', XDG: 'DOGE' };

const ASSET_EXCEPTIONS = {
    bitvavo: {
        aliases: {
            LUNA: 'LUNC',
            LUNA2: 'LUNA',
            EDGE: 'DEFINITIVE'
        },
        excludedAssets: []
    },
    kraken: {
        aliases: {
            ...KRAKEN_WEBSOCKET_ALIASES,
            LUNA: 'LUNC',
            LUNA2: 'LUNA',
            LIT: 'LITENTRY',
            LIGHTER: 'LIT',
            SUP: 'SUPERP',
            EDGE: 'DEFINITIVE',
            ONE: 'ONECHAIN'
        },
        subscriptionAliases: KRAKEN_WEBSOCKET_ALIASES,
        excludedAssets: []
    },
    okx: {
        aliases: { AI: 'GENSYN' },
        excludedAssets: ['XTER']
    },
    kucoin: {
        aliases: {
            SUP: 'SUPERP',
            AIR: 'AIROUTER',
            RWA: 'RWAINC',
            AI: 'GENSYN'
        },
        excludedAssets: []
    },
    bitget: {
        aliases: { SUP: 'SUPERP', AI: 'GENSYN' },
        excludedAssets: []
    },
    gateio: {
        aliases: {
            EDGE: 'DEFINITIVE',
            SUP: 'SUPERTX',
            UP: 'UNITAS',
            SUPERFORM: 'UP',
            AIGENSYN: 'GENSYN'
        },
        excludedAssets: []
    }
};

export default ASSET_EXCEPTIONS;
