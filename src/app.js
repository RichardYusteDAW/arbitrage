import dotenv from 'dotenv';
import { getRefreshWithdrawalStatusUseCase } from './01-common/containers/usecases/refreshWithdrawalStatusUseCaseIoC.js';
import { TIMING } from './config.js';
import ArbitrageController from './02-presentation/controllers/ArbitrageController.js';
import { renderConsole } from './02-presentation/console.js';

import { getStartMarketDataUseCase } from './01-common/containers/usecases/startMarketDataUseCaseIoC.js';
import { getStopMarketDataUseCase } from './01-common/containers/usecases/stopMarketDataUseCaseIoC.js';
import { getOpportunitiesUseCase } from './01-common/containers/usecases/getOpportunitiesUseCaseIoC.js';
import { getMarketStatusUseCase } from './01-common/containers/usecases/getMarketStatusUseCaseIoC.js';

dotenv.config({ quiet: true });

const arbitrageController = new ArbitrageController({
    startMarketData: getStartMarketDataUseCase(),
    stopMarketData: getStopMarketDataUseCase(),
    getOpportunities: getOpportunitiesUseCase(),
    getMarketStatus: getMarketStatusUseCase(),
    refreshWithdrawalStatus: getRefreshWithdrawalStatusUseCase(),
    renderConsole
});

arbitrageController.start();
arbitrageController.render();
const renderTimer = setInterval(() => arbitrageController.render(), TIMING.renderInterval);

const stop = () => {
    clearInterval(renderTimer);
    arbitrageController.stop();
};

process.once('SIGINT', stop);
process.once('SIGTERM', stop);