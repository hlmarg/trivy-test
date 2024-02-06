import { DateTime } from 'luxon';
import { ExecutionStatus } from '../../shared/enums';
import { getParams, hasIgnoreTerm, randomSleep, sleep } from '../../shared/helpers';
import { Market, ScrapedVehicle, ScraperResults } from '../../shared/interfaces';
import { LogService } from '../../shared/services';
import { AutotraderListing, getMarketPayload } from './autotrader-helper';
import { SCRAPER_DEFAULT_SETTINGS } from '../../shared';
import * as fs from 'fs';
import axios from 'axios';
import * as cheerio from 'cheerio';

const baseUrl = 'https://www.autotrader.com';

/**
 * @description Execute the autotrader scraper
 * @param _market - The market to scrape
 * @param _logger - The logger service
 *
 */
export const executeScraper = async (_market: Market, _logger: LogService): Promise<ScraperResults> => {
  try {
    _logger.log(`Executing autotrader for market ${_market.id}`);

    const carsParams = getParams(_market);

    let city: string;
    let state: string;

    try {
      const locationPathUrl = '/cars-for-sale/bonnet-reference/markets';

      const apiRequestUrlToGetLocationInfo = `${baseUrl}${locationPathUrl}?zip=${_market.zipCode}`;

      const {
        data: { payload },
      }: { data: { payload: { city: string; state: string } } } = await axios.get(apiRequestUrlToGetLocationInfo);

      _logger.log(`Executing get to ${apiRequestUrlToGetLocationInfo}`);

      _logger.log(`Got location info for ${_market.zipCode}: ${payload.city}, ${payload.state}`);

      city = payload.city.toLocaleLowerCase();
      state = payload.state.toLocaleLowerCase();
    } catch (error) {
      _logger.log('Error getting base url or location info');
      _logger.error(error);

      throw error;
    }

    let marketPayload: unknown;
    let totalResults = 0;
    let htmlData: string;

    let marketListingsUrl: string;

    try {
      marketPayload = getMarketPayload(_market, carsParams);

      // Example url 'https://www.autotrader.com/cars-for-sale/all-cars/by-owner/cars-between-2900-and-200000/aurora-co?endYear=2023&isNewSearch=true&maxMileage=100000&searchRadius=100&startYear=2014&zip=80012'

      marketListingsUrl = `${baseUrl}/cars-for-sale/all-cars/by-owner/cars-between-${carsParams.minPrice}-and-${
        carsParams.maxPrice
      }/${city}-${state}?${new URLSearchParams(marketPayload as any).toString()}`;

      _logger.log(`Executing get to ${marketListingsUrl}`);

      const { data: baseSearchResults } = await axios.get(`${marketListingsUrl}`);

      htmlData = baseSearchResults;
    } catch (error) {
      _logger.log('There was an error retrieving the base results');
      _logger.error(error);
    }

    let $: cheerio.CheerioAPI;

    // Get html information using cheerio
    try {
      $ = cheerio.load(htmlData);

      const totalResultsText = $('.results-text-container .text-bold:last-child').text();

      if (!totalResultsText) {
        throw new Error('There was an error getting the total results');
      }

      totalResults = Number(totalResultsText.split(' ')[0].replace(',', ''));

      _logger.log(`Total results: ${totalResults}`);
    } catch (error) {
      _logger.log('There was an error getting the total results');
      _logger.error(error);
    }

    await randomSleep();

    _logger.log('Starting with the initial records for pull');
    let startAt = 0;

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
      `Processing ${totalResults}, up to ${carsParams.daysSinceListed} days old and to a maximum of ${maxResults} vehicles`,
    );

    executionResults.totalVehicles = totalResults;

    do {
      let parsedVehicles: ScrapedVehicle[] = [];

      try {
        const pageUrl = `${marketListingsUrl}${startAt > 0 ? `&firstRecord=${startAt}` : ''}`;

        const { data } = await axios.get(pageUrl);

        $ = cheerio.load(data);
        const pageTotalListings = $('.results-text-container .text-bold:first-child').text();
        _logger.log(`Got ${pageTotalListings || 0} listings`);

        const listings = await getListingsFromHTML($);

        parsedVehicles = await processListings(listings, _logger);
      } catch (error) {
        _logger.log(`There was an error retrieving the listings starting at ${startAt}`);
        _logger.error(error);
      } finally {
        startAt += 25;
      }

      // Process results
      try {
        for (const vehicleDetails of parsedVehicles) {
          // Validate expiration date
          const expirationDate = DateTime.now().minus({ days: +carsParams.daysSinceListed });
          const listingDate = DateTime.fromISO(vehicleDetails.listingDate);
          if (listingDate < expirationDate) {
            _logger.log(`Vehicle ${vehicleDetails.link} is outside the expiration date`);
            _logger.log('Stopping execution due vehicles being outside the expiration date');
            break;
          }

          // Validates make and model
          if (!vehicleDetails.make || !vehicleDetails.model) {
            _logger.log(`Vehicle ${vehicleDetails.link} is missing make or model`);
            skippedVehicles.push(vehicleDetails);
            continue;
          }

          // Check for ignored terms
          if (
            [vehicleDetails.description, vehicleDetails.originalTitle, vehicleDetails.sellerName].some(hasIgnoreTerm)
          ) {
            _logger.log(`Vehicle ${vehicleDetails.link} contains ignored terms`);
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

      if (startAt >= totalResults) {
        break;
      }
    } while (startAt < totalResults);

    // Save the results to a file
    if (!!+process.env.AUTOTRADER_SAVE_RESULTS) {
      try {
        await fs.promises.mkdir('executions', { recursive: true });
        const millis = DateTime.now().toMillis();

        await fs.promises.writeFile(
          `executions/autotrader-results-${_market.dealershipGroup?.name} (${_market?.location})-${millis}.json`.toLowerCase(),
          JSON.stringify(scrapedVehicles, null, 2),
        );

        await fs.promises.writeFile(
          `executions/autotrader-skipped-${_market.dealershipGroup?.name} (${_market?.location})-${millis}.json`.toLowerCase(),
          JSON.stringify(skippedVehicles, null, 2),
        );
      } catch (e) {}
    }

    // Set the results
    executionResults.skippedVehicles = executionResults.totalVehicles - executionResults.validVehicles;
    executionResults.results = scrapedVehicles;
    return executionResults;
  } catch (error) {
    await sleep(10000);

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

/**
 * @description Process the listings for the vehicles get from autotrader
 * @param listings - Autotrader listings
 * @param _logger - Logger service
 */
const processListings = async (listings: any[], _logger: LogService) => {
  const scrapedVehicles: ScrapedVehicle[] = [];

  try {
    for (const vehicle of listings) {
      const vehicleLink = vehicle.url;
      _logger.log(`Processing vehicle ${vehicle.vehicleIdentificationNumber} (${vehicleLink})`);
      let data: AutotraderListing;

      // Get details for the vehicle
      try {
        // NOTE: This API is magic, it returns the images of the vehicle
        const detailUrl = `https://www.autotrader.com/marketplace/api/listings/${vehicle.vehicleIdentificationNumber}`;

        const { data: apiData } = await axios.get<AutotraderListing>(detailUrl);

        data = apiData;
      } catch (error) {
        _logger.log(`There was an error getting the details for the vehicle ${vehicle.vehicleIdentificationNumber}`);
        _logger.error(error);
      }

      // Create the scraped vehicle

      const scrapedVehicle: ScrapedVehicle = {
        vin: data.vin || null,
        year: data.year,
        make: data.make || '',
        model: data?.model || '',
        trim: data?.trim?.replace('Used', '') || '',
        title: `${data.year} ${data.make} ${data.model}` || '',
        originalTitle: data.vdp_heading.replace('Used', '') || '',
        askingPrice: Math.round(data.price) || 0,
        mileage: data.mileage || 0,
        description: data.description || '',
        link: data.vdp_url || '',
        images: [],
        vehicleOriginalId: data.id,
        totalOwners: 0,
        sellerName: '',
        listingDate: '',
        sellerPhone: '',
        sellerEmail: '',
        suspectedDealer: false,
      };

      // Process images
      const images = data.images.map((image) => image.url) || [];
      scrapedVehicle.images = images;

      // Process seller info and listing date
      scrapedVehicle.listingDate = data.published;
      scrapedVehicle.sellerName = data?.public_seller_info?.first_name;

      scrapedVehicles.push(scrapedVehicle);
      _logger.log(`Finished processing vehicle ${vehicle.vehicleIdentificationNumber} (${vehicleLink})`);
    }
  } catch (error) {
    _logger.log('There was an error processing the listing');
    _logger.error(error);
  }

  return scrapedVehicles;
};

async function getListingsFromHTML($: cheerio.CheerioAPI) {
  // get the following script tags content: script data-cmp="lstgSchema" type="application/ld+json"

  const scripts = $('script[data-cmp="lstgSchema"]');

  const vehiclesData = scripts
    .map((_, script) => {
      const scriptText = $(script).html();

      const vehicleData = JSON.parse(scriptText);
      return vehicleData;
    })
    .toArray();

  return vehiclesData;
}
