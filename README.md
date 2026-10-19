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

## Disponibilidad de transferencias

La columna `withdraw` muestra la retirada en el exchange de compra y `deposit`, el dep?sito en el exchange de venta. Cada direcci?n indica `true` si alguna red est? habilitada, `false` si todas las conocidas est?n bloqueadas y `null` si el dato es desconocido, fallido o caducado. Se muestran en azul y rojo en terminales con color. Todav?a no se comprueba que ambos exchanges tengan una misma red disponible.

Se consulta la disponibilidad al arrancar y cada minuto (`transferRefreshInterval`), sin bloquear las cotizaciones. KuCoin, Bitget y Gate.io utilizan endpoints p?blicos; Binance, Kraken, Bybit y OKX utilizan las credenciales de lectura de `.env`. Coinbase muestra `null`. Los estados utilizan el mismo cat?logo de excepciones que los pares.

### Binance autenticado

La aplicaci?n carga autom?ticamente `.env` desde la ra?z. Define `BINANCE_API_KEY` y `BINANCE_API_SECRET` con una clave HMAC de lectura. Binance consulta la hora del servidor y firma `GET /sapi/v1/capital/config/getall` para obtener retiradas por red. Sin credenciales o si falla la consulta, `withdraw` queda en `null`. No se realizan operaciones ni retiradas.

### Kraken autenticado

Define `KRAKEN_API_KEY` y `KRAKEN_API_SECRET` en `.env`, con permiso Query Funds. Se firma con SHA256/HMAC-SHA512 la consulta de lectura `GET /funding/v1/assets/withdraw?asset_class=currency` y su equivalente `/funding/v1/assets/deposit?asset_class=currency`, y se contrastan con `GET /0/public/Assets`. Se mantienen las equivalencias del cat?logo. Los estados desconocidos y los errores siguen produciendo `null`. La disponibilidad se refiere al activo y a la cuenta, sin identificar una red concreta.

### Bybit autenticado

Define `BYBIT_API_KEY` y `BYBIT_API_SECRET` en `.env`, con una clave HMAC de lectura del dominio global Bybit. Se consulta la hora del servidor y se firma `GET /v5/asset/coin/query-info` con HMAC-SHA256. `chainWithdraw` y `chainDeposit` indican el estado por red; una comisi?n vac?a indica que esa red no admite retiradas. Sin credenciales, con error o sin datos suficientes, el estado es `null`.

### OKX autenticado

Define `OKX_API_KEY`, `OKX_API_SECRET` y `OKX_API_PASSPHRASE` en `.env`. Se consulta la hora del servidor y se firma `GET /api/v5/asset/currencies` con HMAC-SHA256 y Base64. Las redes se agrupan por moneda y `canWd` y `canDep` determinan su disponibilidad. Si falta cualquiera de las tres credenciales o falla la consulta, `withdraw` es `null`. Se conserva la exclusi?n de XTER.

Las consultas autenticadas de OKX usan por defecto `https://eea.okx.com` para la cuenta europea. Se puede configurar otro dominio oficial mediante `OKX_API_BASE_URL`. La API p?blica de precios mantiene su configuraci?n.
