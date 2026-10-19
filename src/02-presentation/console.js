import { inspect } from 'node:util';
import { Console } from 'node:console';
import { Writable } from 'node:stream';
import { TIMING } from '../config.js';

const formatNumber = (value, decimals = 2) => value?.toLocaleString('es-ES', {
    useGrouping: 'always',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
}) ?? null;

const formatOpportunity = opportunity => ({
    symbol: opportunity.symbol,
    buy: opportunity.buy,
    sell: opportunity.sell,
    profitability: formatNumber(opportunity.profitability) + '%',
    quantity: formatNumber(opportunity.quantity, 0),
    maxVolume: opportunity.maxVolumeUSD == null ? null : '$' + formatNumber(opportunity.maxVolumeUSD),
    profit: opportunity.profitUSD == null ? null : '$' + formatNumber(opportunity.profitUSD),
    withdraw: opportunity.withdraw ?? null,
    deposit: opportunity.deposit ?? null
});

const COLORS = { white: 37, blue: 34, green: 32, red: 31, orange: '38;5;208' };

const colorText = (value, color = 'white') => {
    if (!process.stdout.isTTY || process.env.NO_COLOR !== undefined)
        return String(value);

    return '\x1b[' + COLORS[color] + 'm' + value + '\x1b[37m';
};

const tableText = (value, color = 'white') => {
    if (!process.stdout.isTTY)
        return value;

    return { [inspect.custom]: () => colorText(value, color) };
};

const fitLine = (line, columns) => {
    const tokens = line.match(/\x1b\[[0-9;]*m|[^]/gu) ?? [];
    let width = 0;
    let result = '';

    for (const token of tokens) {
        if (!token.startsWith('\x1b') && ++width > columns - 1)
            break;

        result += token;
    }

    return result + '\x1b[0m';
};

const renderConsole = (opportunities, exchangeStatuses) => {
    console.clear();

    const sortedOpportunities = [...opportunities].sort((a, b) =>
        (b.profitUSD ?? -Infinity) - (a.profitUSD ?? -Infinity));

    const interactive = process.stdout.isTTY;

    if (!interactive)
        process.stdout.write('\x1b[3J\x1b[2J\x1b[H');
    const columns = process.stdout.columns || 120;
    const height = process.stdout.rows || 40;
    let frame = '';
    const output = interactive ? new Console({
        colorMode: false,
        stdout: new Writable({
            write(chunk, encoding, callback) {
                frame += chunk.toString();
                callback();
            }
        })
    }) : console;

    output.log(`Arbitraje | ${new Date().toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid' })} | refresco: ${TIMING.renderInterval / 1000} s`);
    output.log(colorText('OPORTUNIDADES:', 'blue') + ' ' + opportunities.length);

    const exchanges = Object.entries(exchangeStatuses);

    if (exchanges.length) {
        output.table({
            ESTADO: Object.fromEntries(exchanges.map(([name, status]) => [name.toUpperCase(), tableText(status.state, status.state === 'conectado' ? 'green' : 'red')])),
            CONEXIONES: Object.fromEntries(exchanges.map(([name, status]) => [name.toUpperCase(), tableText(status.connections + '/' + status.totalConnections)])),
            PARES: Object.fromEntries(exchanges.map(([name, status]) => [name.toUpperCase(), status.quotes]))
        });
    }

    for (const [name, status] of exchanges) {
        if (status.error)
            output.log(colorText(name + ': ' + status.error, 'orange'));
    }

    const headerLines = frame.split('\n').length - 1;
    const rowLimit = interactive ? Math.max(0, height - headerLines - 5) : 32;

    const opportunityRows = sortedOpportunities.slice(0, rowLimit).map(opportunity =>
        Object.fromEntries(Object.entries(formatOpportunity(opportunity)).map(([name, value]) => {
            const availability = name === 'withdraw' || name === 'deposit';
            const color = availability ? (value === true ? 'green' : 'red') : 'white';
            return [interactive ? name.toUpperCase() : name, tableText(value, color)];
        })));
    output.table(opportunityRows);

    if (interactive) {
        const lines = frame.trimEnd().split('\n').slice(0, Math.max(0, height - 1));
        const visible = lines.map((line, index) => {
            const header = /^\S\s+\(index\)/.test(line);
            let label = header ? line.replace('(index)', '       ') : line;

            if (index >= headerLines) {
                label = label
                    .replace(/^([\u250c\u251c\u2514])\u2500+[\u252c\u253c\u2534]/, '$1')
                    .replace(/^\u2502[^\u2502]*\u2502/, '\u2502');
            }
            const text = header
                ? label.replace(/[^\s\u2502]+/gu, value => colorText(value, 'blue'))
                : label;
            return fitLine(colorText(text), columns);
        });
        process.stdout.write(visible.map(line => line + '\x1b[K').join('\n') + '\x1b[J');
    }
};

export { renderConsole, formatOpportunity };