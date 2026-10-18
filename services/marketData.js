import { TIMING } from '../data/settings.js';
import { createRequestClient } from './requestClient.js';
import { selectPairs } from './pairSelection.js';
import { QuoteStore } from './quoteStore.js';
import { WebSocketConnection } from './webSocketConnection.js';

const createMarketDataService = (exchanges, {
    fetchImpl = globalThis.fetch,
    WebSocketImpl = globalThis.WebSocket,
    reconnectDelay = TIMING.reconnectDelay,
    quoteMaxAge = TIMING.quoteMaxAge
} = {}) => {
    const exchangeNames = Object.keys(exchanges);
    const quotes = new QuoteStore(exchangeNames, quoteMaxAge);
    const client = createRequestClient({ fetchImpl });
    const catalogs = {};
    const states = Object.fromEntries(exchangeNames.map(name => [name, { state: 'pendiente', error: null }]));
    const connections = new Set();
    const discoveryTimers = new Set();
    let stopped = false;
    let started = false;

    const closeConnections = () => {
        for (const connection of connections)
            connection.stop();

        connections.clear();
    };

    const rebuildConnections = () => {
        closeConnections();
        quotes.clear();

        for (const [exchangeName, pairs] of Object.entries(selectPairs(catalogs))) {
            const config = exchanges[exchangeName];
            states[exchangeName] = { state: pairs.length ? 'conectando' : 'sin pares compartidos', error: null };

            for (let index = 0; index < pairs.length; index += config.maxPairsPerConnection) {
                const groupPairs = pairs.slice(index, index + config.maxPairsPerConnection);
                const connection = new WebSocketConnection({
                    exchangeName,
                    config,
                    pairs: groupPairs,
                    WebSocketImpl,
                    reconnectDelay,
                    onTickers: tickers => quotes.update(exchangeName, tickers),
                    onDisconnect: () => quotes.remove(exchangeName, groupPairs),
                    onState: (state, error) => { states[exchangeName] = { state, error }; }
                });
                connections.add(connection);
                connection.start((index / config.maxPairsPerConnection) * TIMING.connectionStagger);
            }
        }
    };

    const discover = async exchangeName => {
        states[exchangeName] = { state: 'cargando pares', error: null };
        try {
            const config = exchanges[exchangeName];
            const pairs = await config.adapter.discover(config, client.request);

            if (stopped)
                return;

            catalogs[exchangeName] = pairs;
            rebuildConnections();

        } catch (error) {
            if (stopped)
                return;

            states[exchangeName] = { state: 'reintentando pares', error: error.message };

            const timer = setTimeout(() => {
                discoveryTimers.delete(timer);
                void discover(exchangeName);
            }, TIMING.discoveryRetryDelay);

            discoveryTimers.add(timer);
        }
    };

    const getStatus = () => Object.fromEntries(exchangeNames.map(exchangeName => {
        const state = states[exchangeName];
        const exchangeConnections = [...connections].filter(connection => connection.exchangeName === exchangeName);
        const connected = exchangeConnections.filter(connection => connection.connected).length;
        const error = exchangeConnections.find(connection => connection.error)?.error ?? state.error;

        return [exchangeName, {
            ...state,
            state: connected && connected < exchangeConnections.length ? 'conexion parcial' : state.state,
            error,
            connections: connected,
            totalConnections: exchangeConnections.length,
            quotes: quotes.getExchangeData(exchangeName).length
        }];
    }));

    return {
        start() {
            if (started)
                return;

            started = true;

            if (!WebSocketImpl)
                throw new Error('WebSocket unavailable: use Node.js 22 or newer');

            for (const name of exchangeNames)
                void discover(name);
        },
        getData: () => quotes.getData(),
        getStatus,
        stop() {
            stopped = true;
            for (const timer of discoveryTimers) clearTimeout(timer);
            discoveryTimers.clear();
            client.abortAll();
            closeConnections();
            quotes.clear();
        }
    };
};

export { createMarketDataService, selectPairs };