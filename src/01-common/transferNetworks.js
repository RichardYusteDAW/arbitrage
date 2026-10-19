const aliases = {
    ethereum: ['ETH', 'ERC20', 'ETHEREUM'],
    arbitrum: ['ARB', 'ARBI', 'ARBEVM', 'ARBITRUM', 'ARBITRUMONE'],
    arbitrumNova: ['ARBITRUMNOVA'],
    base: ['BASE', 'BASEMAINNET'],
    optimism: ['OP', 'OPTIMISM', 'OPMAINNET'],
    polygon: ['MATIC', 'POLYGON', 'POLYGONPOS'],
    bsc: ['BSC', 'BEP20', 'BNBSMARTCHAIN', 'BNBCHAIN', 'BINANCESMARTCHAIN'],
    beacon: ['BNB', 'BEP2', 'BINANCECHAIN'],
    bitcoin: ['BTC', 'BITCOIN'],
    tron: ['TRX', 'TRC20', 'TRON'],
    solana: ['SOL', 'SOLANA'],
    avalanche: ['AVAXC', 'CCHAIN', 'AVALANCHECCHAIN'],
    merlin: ['MERL', 'MERLIN', 'MERLINNETWORK'],
    aptos: ['APT', 'APTOS'],
    sui: ['SUI'],
    cosmos: ['ATOM', 'COSMOS'],
    polkadot: ['DOT', 'POLKADOT'],
    cardano: ['ADA', 'CARDANO'],
    ripple: ['XRP', 'RIPPLE'],
    litecoin: ['LTC', 'LITECOIN'],
    dogecoin: ['DOGE', 'DOGECOIN'],
    stellar: ['XLM', 'STELLAR'],
    ton: ['TON', 'TONCOIN', 'THEOPENNETWORK', 'THEOPENNETWORKTON'],
    near: ['NEAR'],
    algorand: ['ALGO', 'ALGORAND'],
    tezos: ['XTZ', 'TEZOS'],
    bitcoinCash: ['BCH', 'BITCOINCASH'],
    terraClassic: ['LUNC', 'TERRACLASSIC'],
    terra: ['LUNA2', 'TERRA2'],
    zksync: ['ZKSYNCERA', 'ZKSYNC'],
    linea: ['LINEA'],
    scroll: ['SCROLL'],
    mantle: ['MANTLE'],
    ink: ['INK'],
    unichain: ['UNICHAIN'],
    lightning: ['LIGHTNING', 'BITCOINLIGHTNING'],
    sonic: ['SONIC']
};

const networks = new Map(Object.entries(aliases).flatMap(([id, names]) => names.map(name => [name, id])));

export default function transferNetworks(entries) {
    const named = entries.filter(entry => typeof entry.name === 'string' && entry.name.length > 0);

    if (!named.length)
        return {};

    return { networks: entries.map(({ name, withdraw, deposit }) => ({
        id: networks.get((name ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')) ?? null,
        name,
        withdraw: typeof withdraw === 'boolean' ? withdraw : null,
        deposit: typeof deposit === 'boolean' ? deposit : null
    })) };
}