import { calculateOpportunities } from './helpers/calculations.js';
import EXCHANGES from './data/exchanges.js';
import { createMarketDataService } from './services/marketData.js';

const marketData = createMarketDataService(EXCHANGES);

const render = () => {
  const opportunities = calculateOpportunities(marketData.getData())
    .sort((a, b) => b.profitability - a.profitability);

  if (process.stdout.isTTY) process.stdout.write('\x1b[H\x1b[2J');
  console.log(`Arbitraje | ${new Date().toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid' })} | refresco: 1 s`);
  for (const [name, status] of Object.entries(marketData.getStatus())) {
    console.log(`${name}: ${status.state} | conexiones ${status.connections}/${status.totalConnections} | pares con datos ${status.quotes}${status.error ? ` | ${status.error}` : ''}`);
  }
  console.log(`Oportunidades: ${opportunities.length} | rentabilidad bruta, sin comisiones | USDT/USDC = USD`);
  const limit = process.stdout.isTTY ? Math.max(1, (process.stdout.rows ?? 30) - 12) : 20;
  console.table(opportunities.slice(0, limit).map(opportunity => ({
    symbol: opportunity.symbol,
    buy: opportunity.buy,
    sell: opportunity.sell,
    profitability: opportunity.profitability.toFixed(4) + '%',
    maxVolumeUSD: opportunity.maxVolumeUSD?.toFixed(2) ?? null,
    profitUSD: opportunity.profitUSD?.toFixed(2) ?? null
  })));
};

marketData.start();
render();
const renderTimer = setInterval(render, 1000);
const stop = () => {
  clearInterval(renderTimer);
  marketData.stop();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
