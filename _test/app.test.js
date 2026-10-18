import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
for (const signal of ['SIGINT', 'SIGTERM']) {
    test(`app arranca, muestra los tres exchanges y se detiene con ${signal}`, async () => {
        const { stdout } = await run(process.execPath, [fileURLToPath(new URL('./fixtures/app-runner.js', import.meta.url))], {
            env: { ...process.env, TEST_STOP_SIGNAL: signal }, timeout: 5000
        });
        const result = JSON.parse(stdout);
        assert.deepEqual(result.tables[0], []); // Immediate render before discovery completes.
        const rows = result.tables.at(-1);
        assert.equal(rows.length, 3);
        assert.deepEqual(rows.map(row => `${row.buy}->${row.sell}`).sort(),
            ['binance->coinbase', 'binance->kraken', 'coinbase->kraken']);
        assert.ok(rows.some(row => row.buy === 'binance' && row.sell === 'coinbase'
            && row.maxVolumeUSD === '50.00' && row.profitUSD === '0.50' && row.profitability === '1.0000%'));
        assert.ok(result.logs.some(line => line.includes('coinbase: conectado')));
        assert.ok(result.logs.some(line => line.includes('binance: conectado')));
        assert.ok(result.logs.some(line => line.includes('kraken: conectado')));
        assert.equal(result.requested.every(url => /exchangeInfo|AssetPairs|\/products/.test(url)), true);
        assert.equal(result.closed, true);
        assert.equal(result.activeIntervals, 0);
    });
}
