/**
 * Par descubierto en un exchange.
 * @typedef {Object} ExchangePair
 * @property {string} id Identificador nativo para las suscripciones.
 * @property {string} symbol Símbolo normalizado utilizado en los cálculos.
 * @property {string} baseAsset
 */

/**
 * Petición JSON. La respuesta externa depende de cada exchange;
 * su adaptador es responsable de interpretarla.
 * @callback JsonRequest
 * @param {string} url
 * @returns {Promise<any>}
 */

/**
 * Contrato común implementado por todos los adaptadores WebSocket.
 * @typedef {Object} ExchangeAdapter
 * @property {(config: ExchangeConfig, request: JsonRequest) => Promise<ExchangePair[]>} discover
 * @property {(pairs: ExchangePair[]) => Object[]} subscriptions
 * @property {(pairs: ExchangePair[]) => (message: any) => import('./ticker.js').TickerData[]} createParser
 * @property {(() => Object)} [heartbeat]
 */

/**
 * @typedef {Object} ExchangeConfig
 * @property {string} websocketUrl
 * @property {string} pairsUrl Endpoint REST de metadatos.
 * @property {number} maxPairsPerConnection
 * @property {ExchangeAdapter} adapter
 */

/** @typedef {Record<string, ExchangeConfig>} ExchangesConfig */
/** @typedef {Record<string, ExchangePair[]>} ExchangeCatalogs */

export {};
