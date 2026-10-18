import { calculateOpportunities } from './helpers/calculations.js';
import EXCHANGES from './data/exchanges.js';
import { TIMING } from './data/settings.js';
import { createMarketDataService } from './services/marketData.js';
import { renderConsole } from './presentation/console.js';

const marketData = createMarketDataService(EXCHANGES);
const render = () => renderConsole(calculateOpportunities(marketData.getData()), marketData.getStatus());

marketData.start();
render();

const renderTimer = setInterval(render, TIMING.renderInterval);

const stop = () => {
  clearInterval(renderTimer);
  marketData.stop();
};

process.once('SIGINT', stop);
process.once('SIGTERM', stop);