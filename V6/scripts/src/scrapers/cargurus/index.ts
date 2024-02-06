import { DateTime } from 'luxon';
import { ExecutionStatus } from '../../shared/enums';
import { getParams, hasIgnoreTerm, randomSleep, sleep } from '../../shared/helpers';
import { Market, ScrapedVehicle, ScraperResults } from '../../shared/interfaces';
import { LogService } from '../../shared/services';
import { cargurusHelper } from './cargurus-dot-com-helper';
import { SCRAPER_DEFAULT_SETTINGS } from '../../shared';
import * as fs from 'fs';
import axios from 'axios';

/**
 * @description Execute the cargurus scraper
 * @param _market - The market to scrape
 * @param _logger - The logger service
 *
 */

const getCookiesFromResponse = (response) => {
  const cookies = response.headers['set-cookie'];
  return cookies ? cookies.join('; ') : '';
};

export const executeScraper = async (_market: Market, _logger: LogService) /*: Promise<ScraperResults>*/ => {
  try {
    _logger.log(`Executing cargurus for market ${_market.id}`);

    const carsParams = getParams(_market);
    const [marketUrl, searchParams] = cargurusHelper.getMarketUrl(_market, carsParams);

    _logger.log(`Market ${_market.id} url: ${marketUrl} `);

    const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';

    // Navigate to the cargurus
    // and Make the initial request
    const makeRequest = async () => {
      try {
        const response = await axios.get(marketUrl as string, {
          // we need to trick the server into thinking we are a browser
          // so we need to add the headers bellow:
          headers: {
            'User-Agent': USER_AGENT,
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });

        return response;
      } catch (error) {
        _logger.log(`Catched error on first request to ${marketUrl}`);
        const cookies = getCookiesFromResponse(error.response);

        if (cookies) {
          _logger.log(`Retrieved cookies and retrying`);
          // Retry the request with the retrieved cookies
          const retryResponse = await axios.get(marketUrl as string, {
            headers: {
              'User-Agent': USER_AGENT,
              'Accept-Language': 'en-US,en;q=0.9',
              Cookie: cookies,
            },
          });

          return retryResponse;
        }
      }
    }; // end of makeRequest

    let parsedVehicles: ScrapedVehicle[] = [];
    // process the initial response and extract the vehicles fur further processing and vehicle detail extraction
    try {
      const response = await makeRequest();
      _logger.log('Got response from market Url');

      parsedVehicles = await getParsedVehicles(response.data, _logger, _market, searchParams);
      _logger.log(`Found ${parsedVehicles.length} vehicles`);
    } catch (err) {
      _logger.log(`Error getting ${marketUrl}`);
      _logger.error(err);
    }

    await randomSleep();

    const skippedVehicles: ScrapedVehicle[] = [];
    const scrapedVehicles: ScrapedVehicle[] = [];

    const executionResults: ScraperResults = {
      success: true,
      executionStatus: ExecutionStatus.Success,
      executionMessage: '',
      totalVehicles: 0,
      skippedVehicles: 0,
      validVehicles: 0,
      results: [],
    };

    const maxResults = +process.env.SCRAPPER_MAX_RESULTS || SCRAPER_DEFAULT_SETTINGS.MAX_RESULTS;
    _logger.log(
      `Processing ${parsedVehicles.length}, up to ${carsParams.daysSinceListed} days old and to a maximum of ${maxResults} vehicles`,
    );

    executionResults.totalVehicles = parsedVehicles.length;

    try {
      for (const vehicleDetails of parsedVehicles) {
        // Validate expiration date
        const expirationDate = DateTime.now().minus({ days: +carsParams.daysSinceListed });
        const listingDate = DateTime.fromISO(vehicleDetails.listingDate);
        if (listingDate < expirationDate) {
          _logger.log(`Vehicle ${vehicleDetails.vehicleOriginalId} is outside the expiration date`);
          _logger.log('Stopping execution due vehicles being outside the expiration date');
          break;
        }

        // Validates make and model
        if (!vehicleDetails.make || !vehicleDetails.model) {
          _logger.log(`Vehicle ${vehicleDetails.vehicleOriginalId} is missing make or model`);
          skippedVehicles.push(vehicleDetails);
          continue;
        }

        // Check for ignored terms
        if ([vehicleDetails.description, vehicleDetails.originalTitle, vehicleDetails.sellerName].some(hasIgnoreTerm)) {
          _logger.log(`Vehicle ${vehicleDetails.vehicleOriginalId} contains ignored terms`);
          skippedVehicles.push(vehicleDetails);
          continue;
        }

        executionResults.validVehicles++;
        scrapedVehicles.push(vehicleDetails);

        // Check if reached the maximum number of vehicles
        if (executionResults.validVehicles >= maxResults) {
          _logger.log(`Reached the maximum number of vehicles`);
          break;
        }
      }
    } catch (error) {
      _logger.log(`Error processing vehicles`);
      _logger.error(error);
    }

    // Save the results to a file
    if (!!+process.env.CARGURUS_SAVE_RESULTS) {
      try {
        await fs.promises.mkdir('executions', { recursive: true });
        const millis = DateTime.now().toMillis();

        await fs.promises.writeFile(
          `executions/cargurus-results-${_market.dealershipGroup?.name} (${_market?.location})-${millis}.json`.toLowerCase(),
          JSON.stringify(scrapedVehicles, null, 2),
        );

        await fs.promises.writeFile(
          `executions/cargurus-skipped-${_market.dealershipGroup?.name} (${_market?.location})-${millis}.json`.toLowerCase(),
          JSON.stringify(skippedVehicles, null, 2),
        );
      } catch (e) {}
    }

    // Set the results
    executionResults.skippedVehicles = executionResults.totalVehicles - executionResults.validVehicles;
    executionResults.results = scrapedVehicles;

    return executionResults;
  } catch (err) {
    await sleep(10000);

    _logger.error(err);

    return {
      success: false,
      executionStatus: ExecutionStatus.Error,
      executionMessage: err.message,
      totalVehicles: 0,
      skippedVehicles: 0,
      validVehicles: 0,
      results: [],
    };
  }
};

const getParsedVehicles = async (
  data: string,
  _logger: LogService,
  _market: Market,
  params: any,
): Promise<ScrapedVehicle[]> => {
  const vehicleListingRegex = /window\.__PREFLIGHT__ = ({.*?});/s;
  const matches = data.match(vehicleListingRegex);
  const vehicles: ScrapedVehicle[] = [];
  const maxResults = +process.env.SCRAPPER_MAX_RESULTS || SCRAPER_DEFAULT_SETTINGS.MAX_RESULTS;

  if (matches && matches.length >= 2) {
    const vehiclesParsedData = JSON.parse(matches[1]);

    if (vehiclesParsedData.droppedFilterCriteria && vehiclesParsedData.droppedFilterCriteria.length > 0) {
      _logger.log(
        `- Cargurus: Currently processing ${_market.dealershipGroup.name} (${_market.location}) market with 0 vehicles`,
      );
    }
    const totalListings = vehiclesParsedData.totalListings;
    _logger.log(
      `- Cargurus: Currently processing ${_market.dealershipGroup.name} (${_market.location}) market with ${totalListings} vehicles`,
    );

    // get vehicle data:
    // wait a little bit before making the request
    await sleep(2000);

    const cargurusApiUrl = 'https://www.cargurus.com/Cars/searchResults.action';
    const detailsBaseUrl = 'https://www.cargurus.com/Cars/inventorylisting/vdp.action';
    const detailApiUrl = 'https://www.cargurus.com/Cars/detailListingJson.action';

    const totalPages = Math.ceil(totalListings / maxResults);

    for (let i = 0; i < totalPages; i++) {
      const paramsWithPage = {
        ...params,
        filtersModified: true,
        maxResults,
        offset: i * maxResults,
      };

      const { data: vehiclesData } = await axios.get(`${cargurusApiUrl}`, {
        params: paramsWithPage,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      }); // end of await axios.get
      _logger.log(`- Cargurus: processing page: ${i + 1} of ${totalPages} pages`);

      const skippedVehicles = [];

      for (const vehicleData of vehiclesData) {
        const paramsForDetail = {
          ...params,
          inclusionType: 'DEFAULT',
          inventoryListing: vehicleData.id,
        };

        const vehicleDetails = await getVehicleDetails(
          vehicleData,
          detailApiUrl,
          paramsForDetail,
          detailsBaseUrl,
          _logger,
        );

        if (!vehicleDetails?.title) {
          _logger.log(`- Cargurus: vehicle ${vehicleDetails.link} is not available anymore`);
          continue;
        }

        // Check for ignored terms
        if ([vehicleDetails.description, vehicleDetails.originalTitle, vehicleDetails.sellerName].some(hasIgnoreTerm)) {
          _logger.log(`Vehicle ${vehicleDetails.link} contains ignored terms`);
          skippedVehicles.push(vehicleDetails);
          _logger.log(`- Cargurus: vehicle ${vehicleDetails.link} contains ignored terms`);
          continue;
        }

        vehicles.push(vehicleDetails);
        _logger.log(
          `Skipped a total of ${skippedVehicles.length} vehicles for page ${i + 1} of ${totalPages} pages in ${
            _market.dealershipGroup.name
          } (${_market.location}) market`,
        );
      }
    } // end of for loop
  }
  return vehicles;
};

const getVehicleDetails = async (
  vehicleData,
  detailApiUrl,
  paramsForDetail,
  detailsBaseUrl,
  _logger: LogService,
): Promise<ScrapedVehicle> => {
  const detailUrl = `${detailsBaseUrl}?listingId=${vehicleData.id}#listing=${vehicleData.id}`;
  _logger.log(`- Cargurus: processing vehicle: ${detailUrl}`);
  try {
    const { data } = await axios.get(detailApiUrl, {
      params: paramsForDetail,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (typeof data === 'string' && data.includes('no longer available')) {
      _logger.log(`- Cargurus: vehicle ${detailUrl} is not available anymore`);

      //   return {
      //     link: detailUrl,
      //   };
    }
    const detail = data.listing;

    const images = detail.pictures?.map((image) => image.url) || [];

    _logger.log(`- Cargurus: vehicle ${detailUrl} is available`);
    _logger.log(
      `- Returning vehicle with title: ${detail.listingTitle}, and year: ${detail.year} and price: ${Math.round(
        detail.price,
      )}`,
    );

    return {
      originalTitle: detail.listingTitle,
      title: `${detail.year} ${detail.makeName} ${detail.modelName}`,
      askingPrice: Math.round(detail.price),
      link: detailUrl,
      mileage: detail.mileage,
      vin: detail?.vin,
      description: detail?.description || '',
      images: images,
      make: detail.makeName,
      model: detail.modelName?.replace('Used', ''),
      trim: detail.trimName?.replace('Used', ''),
      year: detail.year,
      totalOwners: detail?.vehicleHistory?.ownerCount,
      listingDate: new Date(detail?.vehicleHistory?.reportDate).toISOString(),
      sellerName: vehicleData?.sellerFirstName,
      vehicleOriginalId: vehicleData.id,
      sellerPhone: '', // TODO: get the seller phone number
      sellerEmail: '', // TODO: get the seller email
      suspectedDealer: false, // TODO: get the suspected dealer
    };
  } catch (error) {
    _logger.log(`- Cargurus: error processing vehicle: ${detailUrl}`);
    _logger.error(error);
    // return {
    //   link: detailUrl,
    // };
  }
};
