import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestClient } from '../services/requestClient.js';

test('peticiones exitosas devuelven JSON y liberan sus controladores', async () => {
    let signal;
    const client = createRequestClient({ fetchImpl: async (url, options) => {
        assert.equal(url, 'metadata');
        signal = options.signal;
        return { ok: true, json: async () => ({ pairs: [] }) };
    } });
    assert.deepEqual(await client.request('metadata'), { pairs: [] });
    client.abortAll();
    assert.equal(signal.aborted, false);
});

test('errores HTTP y errores de JSON se propagan', async () => {
    const failedHttp = createRequestClient({ fetchImpl: async () => ({ ok: false, status: 503 }) });
    await assert.rejects(failedHttp.request('metadata'), /HTTP 503/);
    const failedJson = createRequestClient({ fetchImpl: async () => ({ ok: true, json: async () => { throw new Error('Bad JSON'); } }) });
    await assert.rejects(failedJson.request('metadata'), /Bad JSON/);
});

test('el timeout aborta la petición pendiente y abortAll cancela el resto', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let aborted = 0;
    const client = createRequestClient({ timeout: 100, fetchImpl: (url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => { aborted++; reject(new Error('Aborted')); });
    }) });
    const first = assert.rejects(client.request('first'), /Aborted/);
    t.mock.timers.tick(100);
    await first;
    const second = assert.rejects(client.request('second'), /Aborted/);
    client.abortAll();
    await second;
    assert.equal(aborted, 2);
});
