import { calculateOpportunities } from "./helpers/calculations.js";
import EXCHANGES from "./data/exchanges.js";

const results = await Promise.all(
  Object.entries(EXCHANGES).map(async ([exchangeName, exchangeConfig]) => {

    const request = async url => {
      const response = await fetch(url);

      if (!response.ok) {
        const error = new Error(`${exchangeName}: HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      const responseData = await response.json();
      exchangeConfig.validate?.(responseData);
      return responseData;
    };

    if (exchangeConfig.load) {
      const responseData = await exchangeConfig.load(exchangeConfig.url, request);
      return [exchangeName, exchangeConfig.normalize(responseData)];
    }

    const urls = [exchangeConfig.url];

    if (exchangeConfig.pairsUrl)
      urls.push(exchangeConfig.pairsUrl);

    const responses = await Promise.all(urls.map(request));

    return [exchangeName, exchangeConfig.normalize(...responses)];
  })
);

const data = Object.fromEntries(results);
const opportunities = calculateOpportunities(data);

console.table(
  opportunities
    .sort((a, b) => b.profitability - a.profitability)
    .map(opportunity => ({
      symbol: opportunity.symbol,
      buy: opportunity.buy,
      sell: opportunity.sell,
      profitability: opportunity.profitability.toFixed(4) + '%',
      maxVolumeUSD: opportunity.maxVolumeUSD?.toFixed(2) ?? null,
      profitUSD: opportunity.profitUSD?.toFixed(2) ?? null
    }))
);