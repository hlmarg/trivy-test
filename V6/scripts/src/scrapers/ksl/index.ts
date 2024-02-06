import { DateTime } from 'luxon';
import { getParams, hasIgnoreTerm, sleep, takeTheNearestRadiusValue } from '../../shared/helpers';
import { Market, ScrapedVehicle, ScraperResults } from '../../shared/interfaces';
import { LogService } from '../../shared/services';
import * as fs from 'fs';
import axios from 'axios';
import { processVehicleData } from './ksl-helper';
import { ExecutionStatus } from '../../shared/enums';

const apiBaseUrl = 'https://cars.ksl.com/nextjs-api/proxy?';
let page = 1;
const perPage = 24;
const totalPages = 0;
let outOfDate = false;
const maximumDays = Number(process.env.SCRAPPER_DAYS_TO_SCRAPE) || 10;

const PER_PAGE = 'perPage';
const PAGE = 'page';
const YEAR_FROM = 'yearFrom';
const YEAR_TO = 'yearTo';
const MILEAGE_FROM = 'mileageFrom';
const MILEAGE_TO = 'mileageTo';
const PRICE_TO = 'priceTo';
const NEW_USED = 'newUsed';
const USED = 'Used';
const SELLER_TYPE = 'sellerType';
const FOR_SALE_BY_OWNER = 'For Sale By Owner';
const ZIP = 'zip';
const MILES = 'miles';
const INCLUDE_FACET_COUNT = 'includeFacetCounts';

export const buildRequestBody = (carsParams: any, _market: Market, page: number) => {
  const radiuses = [10, 25, 50, 100, 150, 200];

  return [
    PER_PAGE,
    perPage,
    PAGE,
    page,
    YEAR_FROM,
    +carsParams.minYear || 1990,
    YEAR_TO,
    +carsParams.maxYear || 2024,
    MILEAGE_FROM,
    0,
    MILEAGE_TO,
    +carsParams.maxMileage || 120000,
    PRICE_TO,
    +carsParams.maxPrice || 13000,
    NEW_USED,
    USED,
    SELLER_TYPE,
    FOR_SALE_BY_OWNER,
    ZIP,
    _market.zipCode,
    MILES,
    takeTheNearestRadiusValue(carsParams.searchRadius || 60, radiuses),
    INCLUDE_FACET_COUNT,
    1,
    'sort',
    0,
  ];
};

export const makeApiRequest = async (payload: unknown, headers: any) => {
  try {
    const response = await axios.post(apiBaseUrl, payload, { headers });
    return response.data.data;
  } catch (error) {
    throw new Error('Error making API request: ' + error.message);
  }
};

export const processVehicles = (
  items: unknown[],
  _logger: LogService,
  _market: Market,
  count: number,
): { results: ScrapedVehicle[]; skipped: ScrapedVehicle[] } => {
  const results: ScrapedVehicle[] = [];
  const skipped: ScrapedVehicle[] = [];

  for (const index in items.slice(0, 500)) {
    const vehicle = items[index];
    _logger.log(
      `- Ksl: Processing vehicle ${Number(index) + 1 + page * perPage} of ${count} from market ${_market.id}`,
    );

    const vehicleData = processVehicleData(vehicle);

    if (vehicleData) {
      const expirationDate = DateTime.now().minus({ days: +maximumDays });
      const listingDate = DateTime.fromISO(vehicleData.listingDate);
      if (listingDate < expirationDate) {
        _logger.log(`- KSL: vehicle ${vehicleData.link} is out of date`);
        outOfDate = true;
        break;
      }

      if (!vehicleData?.title) {
        _logger.log(`- KSL: vehicle ${vehicleData.link} is not available unknownmore`);
        continue;
      }

      // Check for ignored terms
      if ([vehicleData.description, vehicleData.originalTitle, vehicleData.sellerName].some(hasIgnoreTerm)) {
        _logger.log(`Vehicle ${vehicleData.link} contains ignored terms`);
        skipped.push(vehicleData);
        _logger.log(`- KSL: vehicle ${vehicleData.link} contains ignored terms`);
        continue;
      }
      results.push(vehicleData);
    } // End of if (vehicleData)

    _logger.log(
      `Skipped a total of ${skipped.length} vehicles for page ${page} of ${totalPages} pages in ${_market.dealershipGroup.name} (${_market.location}) market`,
    );
    _logger.log(
      `Found a total of ${results.length} vehicles for page ${page} of ${totalPages} pages in ${_market.dealershipGroup.name} (${_market.location}) market`,
    );
  } // End of for loop

  return { results, skipped };
};

export const saveResultsToFile = async (
  _market: Market,
  results: ScrapedVehicle[],
  skipped: ScrapedVehicle[],
): Promise<void> => {
  try {
    await fs.promises.mkdir('executions', { recursive: true });
    const millis = DateTime.now().toMillis();

    await fs.promises.writeFile(
      `executions/ksl-results-${_market.dealershipGroup?.name} (${_market?.location})-${millis}.json`.toLowerCase(),
      JSON.stringify(results, null, 2),
    );

    await fs.promises.writeFile(
      `executions/ksl-skipped-${_market.dealershipGroup?.name} (${_market?.location})-${millis}.json`.toLowerCase(),
      JSON.stringify(skipped, null, 2),
    );
  } catch (e) {
    throw new Error('Error saving results to file: ' + e.message);
  }
};

export const executeScraper = async (_market: Market, _logger: LogService) => {
  try {
    _logger.log(`Executing KSL for market ${_market.id}`);
    const carsParams = getParams(_market);
    let results: ScrapedVehicle[] = [];
    let skipped: ScrapedVehicle[] = [];

    const executionResults: ScraperResults = {
      success: true,
      executionStatus: ExecutionStatus.Success,
      executionMessage: '',
      totalVehicles: 0,
      skippedVehicles: 0,
      validVehicles: 0,
      results: [],
    };

    do {
      try {
        const body = buildRequestBody(carsParams, _market, page);
        const headers = {
          'Content-Type': 'application/json',
          'User-Agent': 'cars-node',
          'X-App-Source': 'frontline',
          'X-DDM-EVENT-USER-AGENT': {
            ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            browser: { name: 'Chrome', version: '120.0.0.0', major: '120' },
            engine: { name: 'Blink', version: '120.0.0.0' },
            os: { name: 'Mac OS', version: '10.15.7' },
            device: { vendor: 'Apple', model: 'Macintosh' },
            cpu: {},
          },
          'X-DDM-EVENT-ACCEPT-LANGUAGE': 'en-US',
          'X-MEMBER-ID': null,
          cookie: '',
        };

        const payload = {
          endpoint: '/classifieds/cars/search/searchByUrlParams',
          options: {
            query: {
              returnCount: perPage,
            },
            body,
            headers: {},
          },
        };

        const { count, items } = await makeApiRequest(payload, headers);

        const { results: processedResults, skipped: processedSkipped } = processVehicles(
          items.slice(0, 500),
          _logger,
          _market,
          count,
        );

        results = processedResults;
        skipped = processedSkipped;

        // Log summary information or perform unknown other post-processing if needed

        if (outOfDate) {
          _logger.log(`- KSL: stopped execution due out of date`);
          break;
        }
        await sleep(2000);
      } catch (error) {
        _logger.log('Error executing scraper for KSL with market: ' + _market.id + ' at page: ' + page);
        _logger.error(error);
      } finally {
        page++;
      }
    } while (page <= totalPages);

    if (process.env.KSL_SAVE_RESULTS !== undefined) {
      await saveResultsToFile(_market, results, skipped);
    }

    executionResults.skippedVehicles = skipped.length || 0;
    executionResults.totalVehicles = skipped.length + results.length || 0;
    executionResults.validVehicles = results.length || 0;
    executionResults.results = results || [];

    return executionResults;
  } catch (error) {
    _logger.log('Error executing scraper for KSL with market: ' + _market.id);
    _logger.error(error);

    return {
      success: false,
      executionStatus: ExecutionStatus.Error,
      executionMessage: error.message,
      totalVehicles: 0,
      skippedVehicles: 0,
      validVehicles: 0,
      results: [],
    };
  }
};
