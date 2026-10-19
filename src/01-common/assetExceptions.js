const KRAKEN_WEBSOCKET_ALIASES = { XBT: 'BTC', XDG: 'DOGE' };

const ASSET_EXCEPTIONS = {
    kraken: {
        aliases: {
            ...KRAKEN_WEBSOCKET_ALIASES,
            LUNA: 'LUNC',
            LUNA2: 'LUNA',
            LIT: 'LITENTRY',
            LIGHTER: 'LIT',
            SUP: 'SUPERP',
            EDGE: 'DEFINITIVE'
        },
        subscriptionAliases: KRAKEN_WEBSOCKET_ALIASES,
        excludedAssets: []
    },
    okx: {
        aliases: {},
        excludedAssets: ['XTER']
    },
    kucoin: {
        aliases: { SUP: 'SUPERP', AIR: 'AIROUTER', RWA: 'RWAINC' },
        excludedAssets: []
    },
    bitget: {
        aliases: { SUP: 'SUPERP' },
        excludedAssets: []
    },
    gateio: {
        aliases: { EDGE: 'DEFINITIVE', SUP: 'SUPERTX' },
        excludedAssets: []
    }
};

export default ASSET_EXCEPTIONS;
