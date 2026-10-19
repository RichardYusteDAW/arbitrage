# Arbitrage

Requiere Node.js 22.4 o superior. No necesita claves de API ni dependencias para WebSocket.

```sh
npm start
npm test
```

La terminal muestra el estado de cada exchange desde el arranque y refresca la tabla cada segundo. Se muestran las mejores oportunidades que caben en la pantalla; el cálculo conserva todas. Con `Ctrl+C` se detiene el servicio. Si la salida está redirigida a un archivo, se imprimen tablas sucesivas en lugar de controlar el cursor.

## Datos

- REST se utiliza para descubrir los pares activos. Los precios y cantidades llegan por WebSocket.
- Gate.io utiliza snapshots spot.order_book de 20 niveles por lado y heartbeat spot.ping.
- KuCoin utiliza /spotMarket/level2Depth50, grupos de 100 pares y token renovado antes de cada conexión; recibe snapshots de 50 niveles.
- Bitget v3 utiliza books5 spot, con snapshots de cinco niveles y heartbeat de texto ping/pong.
- Bybit utiliza orderbook.50 para spot, con snapshot inicial y cambios incrementales. Heartbeat cada 20 segundos y suscripciones de hasta 10 pares por mensaje.
- OKX utiliza books5 con snapshots de cinco niveles, heartbeat ping/pong y grupos de 100 pares.
- Binance utiliza profundidad parcial combinada depth20@100ms; Kraken, book de 25 niveles; Coinbase, level2 y heartbeats, conservando los primeros 50 niveles para los cálculos.
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

Los cálculos recorren los asks de compra y los bids de venta hasta que el siguiente tramo deja de ser rentable. QUANTITY es la cantidad de activo base; MAXVOLUME, su coste total; PROFIT, ingreso total menos coste. PROFITABILITY se calcula con esos totales, sin comisiones ni costes de transferencia. Los importes en dólares llevan $. USD, USDT y USDC se consideran equivalentes; para otras cotizaciones se busca conversión a USD, USDT o USDC en ese orden. Sin conversión, los importes son null pero se conserva la cantidad. El volumen se limita a los niveles recibidos, no a toda la liquidez del exchange.

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

## Nuevos exchanges

La configuración incorpora Bitstamp, Bitvavo, Crypto.com (cryptocom), Gemini y Bitfinex, con los mismos casos de uso y servicios de conexiones que los anteriores.

| Exchange | Datos de mercado | Depósitos y retiradas |
|---|---|---|
| Bitstamp | Snapshots de order_book; solo mercados SPOT habilitados | API pública currencies, por red |
| Bitvavo | book incremental con snapshot inicial getBook y comprobación de nonce; se conservan 50 niveles | API pública assets |
| Crypto.com | book de 50 niveles en snapshots cada 500 ms; solo CCY_PAIR de criptomonedas negociables | null hasta incorporar una fuente de disponibilidad |
| Gemini | depth20@100ms sobre ws.gemini.com; se excluyen perpetuals y contratos de eventos | null hasta incorporar una fuente de disponibilidad |
| Bitfinex | book P0/F0 de 25 niveles por lado; se excluyen pruebas, derivados y valores | Configuración pública de métodos y estado de wallets |

Bitfinex conserva los identificadores nativos para las suscripciones y utiliza su mapa oficial de monedas para comparar, por ejemplo UST como USDT y DSH como DASH. Su ticker no se usa para calcular volumen porque suma cantidades de varios niveles. El libro de 25 niveles permite calcular el coste y el ingreso de cada tramo.

Crypto.com espera un segundo antes de suscribirse y responde al heartbeat del servidor con el mismo id. El servicio WebSocket cancela esa suscripción pendiente al detenerse o desconectarse. Bitvavo y Gemini envían sus mensajes públicos de mantenimiento de conexión; Bitfinex utiliza ping.

Referencias oficiales: [Bitstamp](https://www.bitstamp.net/api/), [Bitvavo ticker24h](https://docs.bitvavo.com/docs/websocket-api/ticker-24-hour-subscription/), [Crypto.com](https://exchange-developer.crypto.com/exchange/v1/docs/api/websocket-single-page/), [Gemini](https://developer.gemini.com/websocket/streams), [Bitfinex book](https://docs.bitfinex.com/reference/ws-public-books) y [Bitfinex configuración](https://docs.bitfinex.com/reference/rest-public-conf).
