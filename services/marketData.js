/**
 * @typedef {Object} ConnectionGroup
 * @property {string} exchangeName
 * @property {import('../models/exchange.js').ExchangeConfig} config
 * @property {import('../models/exchange.js').ExchangePair[]} pairs
 * @property {number} generation
 * @property {number} attempts
 * @property {boolean} connected
 * @property {WebSocket} [socket]
 * @property {ReturnType<typeof setTimeout>} [connectionTimer]
 * @property {ReturnType<typeof setInterval>} [watchdog]
 * @property {number} [lastMessage]
 * @property {string|null} [error]
 */

/**
 * @param {import('../models/exchange.js').ExchangeCatalogs} catalogs
 * @returns {import('../models/exchange.js').ExchangeCatalogs}
 */
const selectPairs = catalogs => {
    const counts = new Map();
    for (const pairs of Object.values(catalogs)) {
        for (const symbol of new Set(pairs.map(pair => pair.symbol)))
            counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
    }
    return Object.fromEntries(Object.entries(catalogs).map(([name, pairs]) => {
        const bases = new Set(pairs.filter(pair => counts.get(pair.symbol) > 1).map(pair => pair.baseAsset));
        return [name, pairs.filter(pair => counts.get(pair.symbol) > 1
            || (bases.has(pair.baseAsset) && ['USDT', 'USDC'].some(quote => pair.symbol === pair.baseAsset + quote)))];
    }));
};

/**
 * @param {import('../models/exchange.js').ExchangesConfig} exchanges
 * @param {Object} [options]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {typeof WebSocket} [options.WebSocketImpl]
 * @param {number} [options.reconnectDelay] Milisegundos.
 * @param {number} [options.quoteMaxAge] Milisegundos.
 */
const createMarketDataService = (exchanges, {
    fetchImpl = globalThis.fetch, WebSocketImpl = globalThis.WebSocket,
    reconnectDelay = 1000, quoteMaxAge = 30000
} = {}) => {
    /** @type {import('../models/exchange.js').ExchangeCatalogs} */
    const catalogs = {};
    /** @type {Record<string, Map<string, import('../models/ticker.js').ReceivedTickerData>>} */
    const exchangeData = Object.fromEntries(Object.keys(exchanges).map(name => [name, new Map()]));
    /** @type {Record<string, { state: string, error: string|null }>} */
    const status = Object.fromEntries(Object.keys(exchanges).map(name => [name, { state: 'pendiente', error: null }]));
    /** @type {Set<ConnectionGroup>} */
    const groups = new Set();
    const timers = new Set();
    const requests = new Set();
    let stopped = false;
    let started = false;
    let generation = 0;

    const later = (callback, delay) => {
        const timer = setTimeout(() => { timers.delete(timer); callback(); }, delay);
        timers.add(timer);
    };
    /** @type {import('../models/exchange.js').JsonRequest} */
    const request = async url => {
        const controller = new AbortController();
        requests.add(controller);
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetchImpl(url, { signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } finally {
            clearTimeout(timer);
            requests.delete(controller);
        }
    };

    /** @param {ConnectionGroup} group */
    const connect = group => {
        if (stopped || group.generation !== generation) return;
        const { exchangeName, config, pairs } = group;
        const parse = config.adapter.createParser(pairs);
        let socket;
        let failed = false;
        const openedAt = Date.now();
        const fail = error => {
            if (failed || stopped || group.generation !== generation) return;
            failed = true;
            clearTimeout(group.connectionTimer);
            clearInterval(group.watchdog);
            for (const pair of pairs) exchangeData[exchangeName].delete(pair.symbol);
            status[exchangeName] = { state: 'reconectando', error: error.message };
            group.error = error.message;
            group.connected = false;
            socket?.close();
            if (Date.now() - openedAt > 60000) group.attempts = 0;
            later(() => connect(group), Math.min(reconnectDelay * 2 ** group.attempts++, 30000));
        };
        try {
            socket = new WebSocketImpl(config.websocketUrl);
            group.socket = socket;
            group.connectionTimer = setTimeout(() => fail(new Error('Connection timeout')), 15000);
            socket.addEventListener('open', () => {
                if (failed || stopped || group.generation !== generation) { socket.close(); return; }
                clearTimeout(group.connectionTimer);
                group.connected = true;
                group.error = null;
                group.lastMessage = Date.now();
                status[exchangeName] = { state: 'conectado', error: null };
                try {
                    for (const subscription of config.adapter.subscriptions(pairs)) socket.send(JSON.stringify(subscription));
                } catch (error) { fail(error); return; }
                group.watchdog = setInterval(() => {
                    if (Date.now() - group.lastMessage > 45000) return fail(new Error('No messages received for 45 seconds'));
                    try {
                        if (config.adapter.heartbeat) socket.send(JSON.stringify(config.adapter.heartbeat()));
                    } catch (error) { fail(error); }
                }, 20000);
            });
            socket.addEventListener('message', event => {
                if (failed || stopped || group.generation !== generation) return;
                group.lastMessage = Date.now();
                try {
                    for (const ticker of parse(JSON.parse(event.data))) {
                        if (![ticker.askPrice, ticker.bidPrice, ticker.askQty, ticker.bidQty]
                            .every(value => Number.isFinite(value) && value > 0)) {
                            exchangeData[exchangeName].delete(ticker.symbol);
                        } else {
                            exchangeData[exchangeName].set(ticker.symbol, { ...ticker, receivedAt: Date.now() });
                        }
                    }
                } catch (error) { fail(error); }
            });
            socket.addEventListener('error', () => fail(new Error('WebSocket connection error')));
            socket.addEventListener('close', event => fail(new Error(`Connection closed (${event.code})`)));
        } catch (error) { fail(error); }
    };

    const rebuildConnections = () => {
        generation++;
        for (const group of groups) {
            clearTimeout(group.connectionTimer);
            clearInterval(group.watchdog);
            group.socket?.close();
        }
        groups.clear();
        for (const data of Object.values(exchangeData)) data.clear();
        for (const [exchangeName, pairs] of Object.entries(selectPairs(catalogs))) {
            const config = exchanges[exchangeName];
            status[exchangeName] = { state: pairs.length ? 'conectando' : 'sin pares compartidos', error: null };
            for (let index = 0; index < pairs.length; index += config.maxPairsPerConnection) {
                /** @type {ConnectionGroup} */
                const group = { exchangeName, config, pairs: pairs.slice(index, index + config.maxPairsPerConnection),
                    generation, attempts: 0, connected: false };
                groups.add(group);
                later(() => connect(group), (index / config.maxPairsPerConnection) * 500);
            }
        }
    };

    const discover = async exchangeName => {
        const config = exchanges[exchangeName];
        status[exchangeName] = { state: 'cargando pares', error: null };
        try {
            const pairs = await config.adapter.discover(config, request);
            if (stopped) return;
            catalogs[exchangeName] = pairs;
            rebuildConnections();
        } catch (error) {
            if (stopped) return;
            status[exchangeName] = { state: 'reintentando pares', error: error.message };
            later(() => { void discover(exchangeName); }, 10000);
        }
    };

    return {
        start() {
            if (started) return;
            started = true;
            if (!WebSocketImpl) throw new Error('WebSocket unavailable: use Node.js 22 or newer');
            for (const name of Object.keys(exchanges)) void discover(name);
        },
        /** @returns {Record<string, import('../models/ticker.js').ReceivedTickerData[]>} */
        getData() {
            const cutoff = Date.now() - quoteMaxAge;
            return Object.fromEntries(Object.entries(exchangeData).map(([name, data]) =>
                [name, [...data.values()].filter(ticker => ticker.receivedAt >= cutoff)]));
        },
        getStatus() {
            return Object.fromEntries(Object.entries(status).map(([name, value]) => {
                const exchangeGroups = [...groups].filter(group => group.exchangeName === name);
                const connected = exchangeGroups.filter(group => group.connected).length;
                const error = exchangeGroups.find(group => group.error)?.error ?? value.error;
                return [name, { ...value,
                    state: connected && connected < exchangeGroups.length ? 'conexion parcial' : value.state,
                    error, connections: connected,
                    totalConnections: exchangeGroups.length,
                    quotes: [...exchangeData[name].values()].filter(ticker => Date.now() - ticker.receivedAt <= quoteMaxAge).length }];
            }));
        },
        stop() {
            stopped = true;
            generation++;
            for (const timer of timers) clearTimeout(timer);
            timers.clear();
            for (const controller of requests) controller.abort();
            for (const group of groups) {
                clearTimeout(group.connectionTimer);
                clearInterval(group.watchdog);
                group.socket?.close();
            }
            groups.clear();
            for (const data of Object.values(exchangeData)) data.clear();
        }
    };
};

export { createMarketDataService, selectPairs };
