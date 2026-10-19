# Arbitrage

Requiere Node.js 22.4 o superior. No necesita claves de API ni dependencias para WebSocket.

```sh
npm start
npm test
```

La terminal muestra el estado de cada exchange desde el arranque y refresca la tabla cada segundo. Se muestran las mejores oportunidades que caben en la pantalla; el cálculo conserva todas. Con `Ctrl+C` se detiene el servicio. Si la salida está redirigida a un archivo, se imprimen tablas sucesivas en lugar de controlar el cursor.

## Datos

- REST se utiliza para descubrir los pares activos. Los precios y cantidades llegan por WebSocket.
- Gate.io utiliza `spot.book_ticker` con precios y cantidades BBO, grupos de 100 pares y heartbeat `spot.ping`.
- KuCoin utiliza `/market/ticker`, grupos de 100 pares y un token p?blico renovado antes de cada conexi?n; el servidor establece los tiempos de heartbeat.
- Bitget v3 utiliza `ticker` spot con precios y cantidades BBO, grupos de 100 pares y heartbeat de texto `ping`/`pong`.
- Bybit utiliza `orderbook.1` para spot, heartbeat cada 20 segundos, grupos de 100 pares y mensajes de suscripci?n de hasta 10 pares.
- OKX utiliza el canal p?blico `tickers`, con heartbeat de texto `ping`/`pong` y grupos de 100 pares.
- Binance utiliza `bookTicker`; Kraken v2, `ticker` con `event_trigger: bbo`; Coinbase, `level2` y `heartbeats`.
- Se suscriben los pares compartidos entre exchanges y sus pares de conversión a USDT/USDC.
- Coinbase conserva el libro completo en memoria, aplica las cantidades absolutas y elimina niveles con cantidad cero. Un salto de secuencia provoca reconexión y una nueva instantánea.
- Las conexiones se reparten en grupos según `maxPairsPerConnection`. Se reconectan automáticamente con una espera creciente de hasta 30 segundos.
- Al desconectarse una conexión se retiran sus cotizaciones. También se excluyen cotizaciones sin actualizaciones durante 30 segundos (`quoteMaxAge` en el servicio).

La configuración de los exchanges está en `src/config.js` y todos los tiempos, en milisegundos, en `src/config.js`.

## Organización

- `src/app.js`: arranque, refresco periódico y parada.
- `src/02-presentation/console.js`: formato y presentación de resultados y estados.
- `src/03-domain/helpers/calculations.js`: creación de mapas y cálculo de oportunidades.
- `src/03-domain/services/pairDiscoveryService.js`: descubrimiento de pares, cat?logos y cancelaci?n de reintentos.
- `src/03-domain/services/connectionService.js`: registro y consulta del estado de conexiones; los casos de uso controlan su cierre.
- `src/03-domain/usecases/`: coordinaci?n de arranque, descubrimiento, suscripci?n, parada y consultas.
- `src/02-presentation/controllers/ArbitrageController.js`: ejecuci?n de casos de uso y presentaci?n por consola.
- `src/01-common/containers/`: creaci?n e inyecci?n de servicios y casos de uso.
- `src/03-domain/services/webSocketConnectionService.js`: suscripciones, heartbeat, timeout y reconexión de una conexión.
- `src/03-domain/services/requestClientService.js`: peticiones REST, timeout y cancelación.
- `src/03-domain/services/pairSelectionService.js`: selección de pares compartidos y conversiones.
- `src/03-domain/services/quoteStoreService.js`: almacenamiento y caducidad de cotizaciones.
- `src/03-domain/services/orderBookService.js`: aplicación de actualizaciones y consulta del mejor bid/ask.
- `src/03-domain/services/adapters/`: interpretación de los mensajes de cada exchange.

Las fórmulas de `src/03-domain/helpers/calculations.js` no se han cambiado: rentabilidad bruta sin comisiones y conversión USDT primero, USDC después; sin ninguno se devuelve `null`. USDT y USDC se consideran equivalentes a USD. El emparejamiento sigue utilizando los símbolos normalizados, sin resolver identidades de tokens que comparten ticker.

## Modelos compartidos

Los módulos utilizan las mismas clases de `src/03-domain/models/` para construir los datos:

- `ticker.js`: `TickerData`; el servicio añade `receivedAt` al guardar una cotización.
- `opportunity.js`: `Opportunity`, con rentabilidad, volumen y beneficio.
- `exchange.js`: `ExchangeConfig` y `ExchangePair`, además del contrato JSDoc de los adaptadores.

Los constructores unifican los campos. La conversión de los mensajes externos sigue en los adaptadores y las validaciones de cotizaciones, en el almacén. Las clases no incorporan validaciones nuevas.

## Pruebas

Todos los tests y sus fixtures están en `_test/`. Se ejecutan con `npm test`, sin conexiones a servicios externos. Cubren los cálculos, los adaptadores, los modelos, el libro de órdenes, las peticiones, las cotizaciones, las conexiones y el arranque y parada de la aplicación.

## Disponibilidad de retiradas

La columna `withdraw` indica si el activo base puede retirarse del exchange de compra por al menos una red. `true`: alguna red habilitada; `false`: todas las redes conocidas bloqueadas; `null`: estado desconocido, consulta fallida o caducada. No comprueba dep?sitos en destino, compatibilidad entre redes ni restricciones de la cuenta.

Se consulta una lista completa de monedas por exchange al arrancar y cada minuto (`withdrawalRefreshInterval`), sin bloquear las cotizaciones. KuCoin, Bitget y Gate.io disponen de adaptadores para sus endpoints p?blicos. Los dem?s exchanges muestran `null` hasta disponer de una fuente adecuada. Los estados se normalizan con el mismo cat?logo de excepciones que los pares.
