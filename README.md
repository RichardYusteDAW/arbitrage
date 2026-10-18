# Arbitrage

Requiere Node.js 22.4 o superior. No necesita claves de API ni dependencias para WebSocket.

```sh
npm start
npm test
```

La terminal muestra el estado de cada exchange desde el arranque y refresca la tabla cada segundo. Se muestran las mejores oportunidades que caben en la pantalla; el cálculo conserva todas. Con `Ctrl+C` se detiene el servicio. Si la salida está redirigida a un archivo, se imprimen tablas sucesivas en lugar de controlar el cursor.

## Datos

- REST se utiliza para descubrir los pares activos. Los precios y cantidades llegan por WebSocket.
- Binance utiliza `bookTicker`; Kraken v2, `ticker` con `event_trigger: bbo`; Coinbase, `level2` y `heartbeats`.
- Se suscriben los pares compartidos entre exchanges y sus pares de conversión a USDT/USDC.
- Coinbase conserva el libro completo en memoria, aplica las cantidades absolutas y elimina niveles con cantidad cero. Un salto de secuencia provoca reconexión y una nueva instantánea.
- Las conexiones se reparten en grupos según `maxPairsPerConnection`. Se reconectan automáticamente con una espera creciente de hasta 30 segundos.
- Al desconectarse una conexión se retiran sus cotizaciones. También se excluyen cotizaciones sin actualizaciones durante 30 segundos (`quoteMaxAge` en el servicio).

La configuración está en `data/exchanges.js`; los adaptadores, en `services/adapters/`; la gestión de conexiones, en `services/marketData.js`. `app.js` obtiene los últimos datos, calcula oportunidades y actualiza la terminal.

Las fórmulas de `helpers/calculations.js` no se han cambiado: rentabilidad bruta sin comisiones y conversión USDT primero, USDC después; sin ninguno se devuelve `null`. USDT y USDC se consideran equivalentes a USD. El emparejamiento sigue utilizando los símbolos normalizados, sin resolver identidades de tokens que comparten ticker.

Los helpers REST anteriores se conservan, pero `app.js` ya no utiliza la carga REST de libros de Coinbase.

## Modelos compartidos

`models/` define los contratos mediante JSDoc, sin clases ni cambios en los objetos en ejecución:

- `ticker.js`: cotizaciones normalizadas, cotizaciones recibidas con fecha y entradas REST admitidas por los cálculos.
- `opportunity.js`: resultado de rentabilidad, volumen y beneficio.
- `exchange.js`: configuración, pares y contrato de los adaptadores WebSocket.

Los módulos referencian estos tipos con `import()` dentro de JSDoc. Son referencias para el editor; no añaden imports ni validaciones en ejecución.
