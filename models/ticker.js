/**
 * Datos normalizados de un par, comunes a todos los exchanges.
 * Los adaptadores producen números; el servicio añade receivedAt al almacenarlos.
 * @typedef {Object} TickerData
 * @property {string} symbol
 * @property {string} baseAsset
 * @property {number} bidPrice
 * @property {number} bidQty
 * @property {number} askPrice
 * @property {number} askQty
 * @property {number} [receivedAt] Instante de recepción, en milisegundos Unix.
 */

/** @typedef {TickerData & { receivedAt: number }} ReceivedTickerData */

/**
 * Entrada admitida por los cálculos y los helpers REST anteriores.
 * Los precios y cantidades REST pueden ser cadenas o cantidades ausentes.
 * @typedef {Object} TickerInput
 * @property {string} symbol
 * @property {string} [baseAsset]
 * @property {number|string} bidPrice
 * @property {number|string|null} bidQty
 * @property {number|string} askPrice
 * @property {number|string|null} askQty
 * @property {number} [receivedAt]
 */

/** @typedef {Record<string, TickerInput[]>} ExchangesData */

export {};
