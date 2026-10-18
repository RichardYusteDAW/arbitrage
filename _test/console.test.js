import test from 'node:test';
import assert from 'node:assert/strict';
import { renderConsole, formatOpportunity } from '../presentation/console.js';
import { Opportunity } from '../models/opportunity.js';

const opportunity = (changes = {}) => new Opportunity({ symbol: 'ETHUSDT', buy: 'a', sell: 'b', profitability: 1.234567,
    maxVolumeUSD: 100.1234, profitUSD: 1.234567, ...changes });

test('presentación formatea importes y porcentajes sin modificar el modelo ni sustituir null', () => {
    const input = opportunity();
    assert.deepEqual(formatOpportunity(input), { symbol: 'ETHUSDT', buy: 'a', sell: 'b', profitability: '1.2346%',
        maxVolumeUSD: '100.12', profitUSD: '1.23' });
    assert.equal(input.profitability, 1.234567);
    assert.equal(formatOpportunity(opportunity({ maxVolumeUSD: null, profitUSD: null })).profitUSD, null);
    assert.equal(formatOpportunity(opportunity({ profitUSD: 0 })).profitUSD, '0.00');
});

test('TTY refresca la pantalla y muestra hasta 32 filas ordenadas sin alterar el array original', () => {
    const writes = [];
    const logs = [];
    let table;
    const input = Array.from({ length: 35 }, (_, index) => opportunity({ profitability: index + 1 }));
    renderConsole(input, { a: { state: 'conectado', connections: 1, totalConnections: 1, quotes: 10, error: null } }, {
        stdout: { isTTY: true, rows: 13, write: text => writes.push(text) },
        output: { log: text => logs.push(text), table: rows => { table = rows; } },
        now: new Date('2026-01-01T12:00:00Z')
    });
    assert.deepEqual(writes, ['\x1b[H\x1b[2J']);
    assert.equal(table.length, 32);
    assert.equal(table[0].profitability, '35.0000%');
    assert.equal(input[0].profitability, 1);
    assert.ok(logs.some(line => line.includes('a: conectado')));
});

test('salida redirigida no controla el cursor y muestra errores de conexión', () => {
    let table;
    const logs = [];
    renderConsole(Array.from({ length: 35 }, () => opportunity()), {
        a: { state: 'reconectando', connections: 0, totalConnections: 1, quotes: 0, error: 'Disconnected' }
    }, { stdout: { isTTY: false, write: () => assert.fail('Unexpected cursor control') },
        output: { log: text => logs.push(text), table: rows => { table = rows; } } });
    assert.equal(table.length, 32);
    assert.ok(logs.some(line => line.includes('Disconnected')));
});
