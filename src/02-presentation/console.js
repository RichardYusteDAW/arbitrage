import { inspect } from 'node:util';
import { TIMING } from '../config.js';

const formatOpportunity = opportunity => ({
    symbol: opportunity.symbol,
    buy: opportunity.buy,
    sell: opportunity.sell,
    profitability: opportunity.profitability.toFixed(4) + '%',
    maxVolumeUSD: opportunity.maxVolumeUSD?.toFixed(2) ?? null,
    profitUSD: opportunity.profitUSD?.toFixed(2) ?? null,
    withdraw: opportunity.withdraw ?? null,
    deposit: opportunity.deposit ?? null
});

const colorAvailability = value => {
    if (typeof value !== 'boolean' || !process.stdout.isTTY || process.env.NO_COLOR !== undefined)
        return value;

    return {
        [inspect.custom]: () => `\x1b[${value ? 34 : 31}m${value}\x1b[0m`
    };
};

const renderConsole = (opportunities, exchangeStatuses) => {
    const sortedOpportunities = [...opportunities].sort((a, b) => b.profitability - a.profitability);

    if (process.stdout.isTTY)
        process.stdout.write('\x1b[H\x1b[2J');

    console.log(`Arbitraje | ${new Date().toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid' })} | refresco: ${TIMING.renderInterval / 1000} s`);

    for (const [exchangeName, status] of Object.entries(exchangeStatuses)) {
        console.log(`${exchangeName}: ${status.state} | conexiones ${status.connections}/${status.totalConnections} | pares con datos ${status.quotes}${status.error ? ` | ${status.error}` : ''}`);
    }

    console.log(`Oportunidades: ${opportunities.length} | rentabilidad bruta, sin comisiones | USDT/USDC = USD | withdraw: salida en compra | deposit: entrada en venta | alguna red; null = desconocido`);
    console.table(sortedOpportunities.slice(0, 32).map(opportunity => {
        const row = formatOpportunity(opportunity);

        return {
            ...row,
            withdraw: colorAvailability(row.withdraw),
            deposit: colorAvailability(row.deposit)
        };
    }));
};

export { renderConsole, formatOpportunity };