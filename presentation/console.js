import { TIMING } from '../data/settings.js';

const formatOpportunity = opportunity => ({
    symbol: opportunity.symbol,
    buy: opportunity.buy,
    sell: opportunity.sell,
    profitability: opportunity.profitability.toFixed(4) + '%',
    maxVolumeUSD: opportunity.maxVolumeUSD?.toFixed(2) ?? null,
    profitUSD: opportunity.profitUSD?.toFixed(2) ?? null
});

const renderConsole = (opportunities, exchangeStatuses, {stdout = process.stdout, output = console, now = new Date()} = {}) => {
    const sortedOpportunities = [...opportunities].sort((a, b) => b.profitability - a.profitability);
    
    if (stdout.isTTY) stdout.write('\x1b[H\x1b[2J');
    output.log(`Arbitraje | ${now.toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid' })} | refresco: ${TIMING.renderInterval / 1000} s`);
    
    for (const [exchangeName, status] of Object.entries(exchangeStatuses)) {
        output.log(`${exchangeName}: ${status.state} | conexiones ${status.connections}/${status.totalConnections} | pares con datos ${status.quotes}${status.error ? ` | ${status.error}` : ''}`);
    }
    
    output.log(`Oportunidades: ${opportunities.length} | rentabilidad bruta, sin comisiones | USDT/USDC = USD`);
    output.table(sortedOpportunities.slice(0, 32).map(formatOpportunity));
};

export { renderConsole, formatOpportunity };