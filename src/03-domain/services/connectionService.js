class ConnectionService {

    #connections = new Set();
    #states;

    constructor(exchangeNames) {
        this.#states = new Map(exchangeNames.map(name => [name, { state: 'pendiente', error: null }]));
    }

    register(connection) {
        this.#connections.add(connection);
    }

    setState(exchangeName, state, error = null) {
        this.#states.set(exchangeName, { state, error });
    }

    getStatus(exchangeName) {
        const state = this.#states.get(exchangeName);
        const connections = [...this.#connections].filter(connection => connection.exchangeName === exchangeName);
        const connected = connections.filter(connection => connection.connected).length;
        return {
            ...state,
            state: connected && connected < connections.length ? 'conexion parcial' : state.state,
            error: connections.find(connection => connection.error)?.error ?? state.error,
            connections: connected,
            totalConnections: connections.length
        };
    }

    getConnections() {
        return [...this.#connections];
    }

    clear() {
        this.#connections.clear();
    }
}

export default ConnectionService;