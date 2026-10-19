import { stripVTControlCharacters } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderConsole, formatOpportunity } from '../src/02-presentation/console.js';
import { Opportunity } from '../src/03-domain/models/opportunity.js';

const mockTerminal = (t, isTTY) => {
    const descriptor = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: isTTY });
    t.after(() => {
        if (descriptor) Object.defineProperty(process.stdout, 'isTTY', descriptor);
        else delete process.stdout.isTTY;
    });
};

const opportunity = (changes = {}) => new Opportunity({ symbol: 'ETHUSDT', buy: 'a', sell: 'b', profitability: 1.234567,
    maxVolumeUSD: 100.1234, profitUSD: 1.234567, ...changes });

test('presentación formatea importes y porcentajes sin modificar el modelo ni sustituir null', () => {
    const input = opportunity();
    assert.deepEqual(formatOpportunity(input), { symbol: 'ETHUSDT', buy: 'a', sell: 'b', profitability: '1,23%',
        quantity: null, maxVolume: '$100,12', profit: '$1,23', withdraw: null, deposit: null });
    assert.equal(input.profitability, 1.234567);
    assert.equal(formatOpportunity(opportunity({ maxVolumeUSD: null, profitUSD: null })).profit, null);
    assert.equal(formatOpportunity(opportunity({ profitUSD: 0 })).profit, '$0,00');
});

for (const [columns, rows] of [[160, 24], [80, 15], [40, 8]]) {
    test(`TTY respeta una terminal de ${columns}x${rows} sin provocar scroll`, t => {
        const noColor = process.env.NO_COLOR;
        delete process.env.NO_COLOR;
        t.after(() => {
            if (noColor === undefined)
                delete process.env.NO_COLOR;
            else
                process.env.NO_COLOR = noColor;
        });
        const writes = [];
        let clears = 0;
        t.mock.method(console, 'clear', () => { clears++; });
        const input = Array.from({ length: 35 }, (_, index) => opportunity({ profitability: index + 1, profitUSD: index + 1 }));
        mockTerminal(t, true);

        for (const [name, value] of Object.entries({ columns, rows })) {
            const descriptor = Object.getOwnPropertyDescriptor(process.stdout, name);
            Object.defineProperty(process.stdout, name, { configurable: true, value });
            t.after(() => {
                if (descriptor)
                    Object.defineProperty(process.stdout, name, descriptor);
                else
                    delete process.stdout[name];
            });
        }

        t.mock.method(process.stdout, 'write', text => { writes.push(text); return true; });
        renderConsole(input, { a: { state: 'conectado', connections: 1, totalConnections: 1, quotes: 10, error: 'Error '.repeat(50) } });
        assert.equal(writes.length, 1);
        const renderedLines = writes[0].split('\n');
        const headers = renderedLines.filter(line => /\x1b\[34m/.test(line) && stripVTControlCharacters(line).startsWith('\u2502'));
        assert.equal(headers.length, rows === 24 ? 2 : 1);
        assert.ok(headers.every(line => line.startsWith('\x1b[37m')));
        assert.ok(!writes[0].includes('(index)'));
        assert.ok(headers.every(line => !/\x1b\[34m[^\x1b]*\u2502/u.test(line)));
        assert.equal(clears, 1);
        assert.ok(writes[0].endsWith('\x1b[J'));
        const lines = renderedLines.map(line => stripVTControlCharacters(line));
        assert.ok(lines.length < rows);
        assert.ok(lines.every(line => [...line].length < columns));
        assert.equal(input[0].profitability, 1);

        if (rows === 24) {
            assert.ok(writes[0].includes('35,00%'));
            const dataRow = lines.find(line => /35,00%/.test(line));
            assert.match(dataRow, /^\u2502\s+ETHUSDT\s+\u2502/);

            if (process.env.NO_COLOR === undefined)
                assert.ok(writes[0].includes('\x1b[32m'));
        }

        renderConsole([], {});
        assert.equal(clears, 2);
        assert.ok(writes[1].endsWith('\x1b[J'));
        assert.ok(stripVTControlCharacters(writes[1]).split('\n').length < rows);
    });
}

test('salida redirigida no controla el cursor y muestra errores de conexión', t => {
    let table;
    const logs = [];
    mockTerminal(t, false);
    const events = [];
    let clears = 0;
    t.mock.method(console, 'clear', () => { clears++; });
    t.mock.method(process.stdout, 'write', text => { events.push(text); return true; });
    t.mock.method(console, 'log', text => { logs.push(text); events.push(text); });
    t.mock.method(console, 'table', rows => { table = rows; });
    renderConsole(Array.from({ length: 35 }, () => opportunity()), {
        a: { state: 'reconectando', connections: 0, totalConnections: 1, quotes: 0, error: 'Disconnected' }
    });
    assert.equal(table.length, 32);
    assert.equal(events[0], '\x1b[3J\x1b[2J\x1b[H');
    assert.equal(clears, 1);
    const nextFrame = events.length;
    renderConsole([], {});
    assert.equal(events[nextFrame], '\x1b[3J\x1b[2J\x1b[H');
    assert.equal(clears, 2);
    assert.ok(logs.some(line => line.includes('Disconnected')));
});
