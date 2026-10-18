// Todos los tiempos se expresan en milisegundos.
const TIMING = {
    requestTimeout: 15000,
    connectionTimeout: 15000,
    inactivityTimeout: 45000,
    heartbeatInterval: 20000,
    reconnectDelay: 1000,
    maxReconnectDelay: 30000,
    stableConnectionDuration: 60000,
    discoveryRetryDelay: 10000,
    connectionStagger: 500,
    quoteMaxAge: 30000,
    renderInterval: 1000
};

export { TIMING };