import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
for (const signal of ['SIGINT', 'SIGTERM']) {
    test(`app arranca, muestra los trece exchanges y se detiene con ${signal}`, async () => {
        const { stdout } = await run(process.execPath, [fileURLToPath(new URL('./fixtures/app-runner.js', import.meta.url))], {
            env: { ...process.env, TEST_STOP_SIGNAL: signal }, timeout: 8000
        });
        const result = JSON.parse(stdout);
        assert.ok(result.screenClears.length >= 2);
        assert.ok(result.screenClears.every(clear => clear === '\x1b[3J\x1b[2J\x1b[H'));
        assert.deepEqual(result.tables[1], []); // Immediate render before discovery completes.
        const rows = result.tables.at(-1);
        assert.equal(rows.length, 12);
        assert.deepEqual(rows.map(row => `${row.buy}->${row.sell}`).sort(),
            ['binance->coinbase', 'binance->kraken', 'bitfinex->kraken', 'bitstamp->kraken', 'bitvavo->kraken', 'bybit->kraken', 'coinbase->kraken', 'cryptocom->kraken', 'gateio->kraken', 'gemini->kraken', 'kucoin->kraken', 'okx->kraken']);
        assert.ok(rows.some(row => row.buy === 'binance' && row.sell === 'coinbase'
            && row.maxVolume === '$50,05' && row.profit === '$0,40' && row.quantity === '1' && row.profitability === '0,80%'));
        assert.equal(result.tables.at(-2).ESTADO.COINBASE, 'conectado');
        assert.equal(result.tables.at(-2).ESTADO.BINANCE, 'conectado');
        assert.equal(result.tables.at(-2).ESTADO.KRAKEN, 'conectado');
        assert.equal(result.requested.every(url => /coin\/query-info|funding\/v1\/methods\/(?:withdraw|deposit)|\/Assets|capital\/config\/getall|\/time|currencies|coins|currency_pairs|symbols|bullet-public|exchangeInfo|instruments-info|AssetPairs|\/products|\/instruments|get-instruments|markets|assets|\/conf\//.test(url)), true);
        assert.equal(result.tables.at(-2).ESTADO.OKX, 'conectado');
        assert.equal(result.tables.at(-2).ESTADO.BYBIT, 'conectado');
        assert.equal(result.tables.at(-2).ESTADO.BITGET, 'conectado');
        assert.equal(result.tables.at(-2).ESTADO.KUCOIN, 'conectado');
        assert.equal(result.tables.at(-2).ESTADO.GATEIO, 'conectado');
        assert.equal(rows.find(row => row.buy === 'gateio').withdraw, true);
        assert.ok(!rows.some(row => row.buy === 'bitget'));
        assert.ok(rows.every(row => row.withdraw !== false && row.deposit !== false));
        assert.equal(rows.find(row => row.buy === 'binance').withdraw, true);
        assert.equal(rows.find(row => row.buy === 'bybit').withdraw, true);
        assert.equal(rows.find(row => row.buy === 'okx').withdraw, true);
        assert.ok(rows.filter(row => row.sell === 'kraken').every(row => row.deposit === true));
        assert.equal(rows.find(row => row.sell === 'coinbase').deposit, null);
        for (const name of ['BITSTAMP', 'BITVAVO', 'CRYPTOCOM', 'GEMINI', 'BITFINEX'])
            assert.equal(result.tables.at(-2).ESTADO[name], 'conectado');

        assert.equal(result.closed, true);
        assert.equal(result.activeIntervals, 0);
    });
}
