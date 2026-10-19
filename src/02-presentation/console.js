import { TIMING } from '../config.js';

const formatOpportunity = opportunity => ({
    symbol: opportunity.symbol,
    buy: opportunity.buy,
    sell: opportunity.sell,
    profitability: opportunity.profitability.toFixed(4) + '%',
    maxVolumeUSD: opportunity.maxVolumeUSD?.toFixed(2) ?? null,
    profitUSD: opportunity.profitUSD?.toFixed(2) ?? null
});

const renderConsole = (opportunities, exchangeStatuses) => {
    const sortedOpportunities = [...opportunities].sort((a, b) => b.profitability - a.profitability);
    
    if (process.stdout.isTTY) process.stdout.write('\x1b[H\x1b[2J');
    console.log(`Arbitraje | ${new Date().toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid' })} | refresco: ${TIMING.renderInterval / 1000} s`);
    
    for (const [exchangeName, status] of Object.entries(exchangeStatuses)) {
        console.log(`${exchangeName}: ${status.state} | conexiones ${status.connections}/${status.totalConnections} | pares con datos ${status.quotes}${status.error ? ` | ${status.error}` : ''}`);
    }
    
    console.log(`Oportunidades: ${opportunities.length} | rentabilidad bruta, sin comisiones | USDT/USDC = USD`);
    console.table(sortedOpportunities.slice(0, 32).map(formatOpportunity));
};

export { renderConsole, formatOpportunity };