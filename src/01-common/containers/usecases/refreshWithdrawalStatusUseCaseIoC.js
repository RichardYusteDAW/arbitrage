import RefreshWithdrawalStatusUseCase from '../../../03-domain/usecases/RefreshWithdrawalStatusUseCase.js';
import { EXCHANGES, TIMING } from '../../../config.js';
import { getRequestClientService } from '../services/requestClientIoC.js';
import { getWithdrawalStatusService } from '../services/withdrawalStatusIoC.js';

let instance;

const getRefreshWithdrawalStatusUseCase = () => {
    if (!instance)
        instance = new RefreshWithdrawalStatusUseCase(
            EXCHANGES,
            getRequestClientService(),
            getWithdrawalStatusService(),
            TIMING.withdrawalRefreshInterval,
            {
                binance: { apiKey: process.env.BINANCE_API_KEY, apiSecret: process.env.BINANCE_API_SECRET },
                kraken: { apiKey: process.env.KRAKEN_API_KEY, apiSecret: process.env.KRAKEN_API_SECRET },
                bybit: { apiKey: process.env.BYBIT_API_KEY, apiSecret: process.env.BYBIT_API_SECRET },
                okx: {
                    apiKey: process.env.OKX_API_KEY,
                    apiSecret: process.env.OKX_API_SECRET,
                    passphrase: process.env.OKX_API_PASSPHRASE,
                    apiBaseUrl: process.env.OKX_API_BASE_URL ?? 'https://eea.okx.com'
                }
            });

    return instance;
};

export { getRefreshWithdrawalStatusUseCase };