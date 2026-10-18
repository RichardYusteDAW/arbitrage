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

La configuración de los exchanges está en `data/exchanges.js` y todos los tiempos, en milisegundos, en `data/settings.js`.

## Organización

- `app.js`: arranque, refresco periódico y parada.
- `presentation/console.js`: formato y presentación de resultados y estados.
- `helpers/calculations.js`: creación de mapas y cálculo de oportunidades.
- `services/marketData.js`: coordinación de descubrimiento, conexiones y datos.
- `services/webSocketConnection.js`: suscripciones, heartbeat, timeout y reconexión de una conexión.
- `services/requestClient.js`: peticiones REST, timeout y cancelación.
- `services/pairSelection.js`: selección de pares compartidos y conversiones.
- `services/quoteStore.js`: almacenamiento y caducidad de cotizaciones.
- `services/orderBook.js`: aplicación de actualizaciones y consulta del mejor bid/ask.
- `services/adapters/`: interpretación de los mensajes de cada exchange.

Las fórmulas de `helpers/calculations.js` no se han cambiado: rentabilidad bruta sin comisiones y conversión USDT primero, USDC después; sin ninguno se devuelve `null`. USDT y USDC se consideran equivalentes a USD. El emparejamiento sigue utilizando los símbolos normalizados, sin resolver identidades de tokens que comparten ticker.

Se han retirado los helpers REST antiguos: la normalización se realiza en los adaptadores, sin mantener dos implementaciones de cada exchange.

## Modelos compartidos

Los módulos utilizan las mismas clases de `models/` para construir los datos:

- `ticker.js`: `TickerData`; el servicio añade `receivedAt` al guardar una cotización.
- `opportunity.js`: `Opportunity`, con rentabilidad, volumen y beneficio.
- `exchange.js`: `ExchangeConfig` y `ExchangePair`, además del contrato JSDoc de los adaptadores.

Los constructores unifican los campos. La conversión de los mensajes externos sigue en los adaptadores y las validaciones de cotizaciones, en el almacén. JSDoc documenta los tipos; las clases no incorporan validaciones nuevas.

## Pruebas

Todos los tests y sus fixtures están en `_test/`. Se ejecutan con `npm test`, sin conexiones a servicios externos. Cubren los cálculos, los adaptadores, los modelos, el libro de órdenes, las peticiones, las cotizaciones, las conexiones y el arranque y parada de la aplicación.
