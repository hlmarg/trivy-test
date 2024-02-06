import { DateTime } from 'luxon';
import { ExecutionStatus } from '../../shared/enums';
import { getParams, hasIgnoreTerm, randomSleep, sleep } from '../../shared/helpers';
import { Market, ScrapedVehicle, ScraperResults } from '../../shared/interfaces';
import { LogService } from '../../shared/services';
import { CarsDotComVehicleData, CarsDotComVehicleList, getMarketUrl } from './cars-dot-com-helper';
import { SCRAPER_DEFAULT_SETTINGS } from '../../shared';
import * as fs from 'fs';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * @description Execute the cars.com scraper
 * @param _market - The market to scrape
 * @param _logger - The logger service
 *
 */
export const executeScraper = async (_market: Market, _logger: LogService): Promise<ScraperResults> => {
  try {
    _logger.log(`Executing cars.com for market ${_market.id}`);

    const carsParams = getParams(_market);
    const marketUrl = getMarketUrl(_market, carsParams);

    // Navigate to the cars.com search link
    _logger.log(`Navigating to ${marketUrl}`);

    let parsedVehicles: ScrapedVehicle[] = [];

    try {
      const response = await axios.get<string>(marketUrl);
      _logger.log('Got response from market Url');

      parsedVehicles = getParsedVehicles(response.data, _logger);
      _logger.log(`Found ${parsedVehicles.length} vehicles`);
    } catch (error) {
      _logger.log(`Error getting ${marketUrl}`);
      _logger.error(error);
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
    if (!!+process.env.CARS_COM_SAVE_RESULTS) {
      try {
        await fs.promises.mkdir('executions', { recursive: true });
        const millis = DateTime.now().toMillis();

        await fs.promises.writeFile(
          `executions/cars-dot-com-results-${_market.dealershipGroup?.name} (${_market?.location})-${millis}.json`.toLowerCase(),
          JSON.stringify(scrapedVehicles, null, 2),
        );

        await fs.promises.writeFile(
          `executions/cars-dot-com-skipped-${_market.dealershipGroup?.name} (${_market?.location})-${millis}.json`.toLowerCase(),
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
 * @description process the html data and return the parsed vehicles from cars.com
 * @param {HTMLResponse} data
 */
const getParsedVehicles = (data: string, _logger: LogService): ScrapedVehicle[] => {
  const $ = cheerio.load(data);

  const cars = $('script[type="application/ld+json"]');

  const carsList: CarsDotComVehicleList[] = JSON.parse(
    $(cars.filter((_, car) => JSON.parse($(car).html())['@type'] === 'ItemList')[0]).html(),
  )?.itemListElement;

  // No cars found
  if (!carsList?.length) {
    return [];
  }

  const scrapedVehicles: ScrapedVehicle[] = [];

  const vehiclesData: CarsDotComVehicleData[] = cars
    .filter((_, car) => JSON.parse($(car).html())['@type'] === 'Vehicle')
    .map((_, car) => JSON.parse($(car).html()))
    .get();

  let index = 1;

  for (const vehicle of vehiclesData) {
    const carListItem = carsList.find((car) => car.position === index);

    if (!carListItem) {
      continue;
    }

    const cleanTitle = vehicle.name.replace('Used', '')?.trim();

    const [year, make, model, ...trimArray] = cleanTitle?.split(' ');
    const title = `${year} ${make} ${model} ${trimArray?.join(' ')}`?.trim();
    const solvedYear = Number(year);

    const link = carListItem?.url.replace(/\/$/, '');
    const urlSplitted = link.split('/');
    const vehicleId = urlSplitted[urlSplitted.length - 2];

    const vehicleHTMLData = $(`.vehicle-card:not(.inventory-ad)[data-listing-id=${vehicleId}]`);

    if (!vehicleHTMLData.length) {
      continue;
    }

    const askingPrice = $(vehicleHTMLData).find('.primary-price')?.text()?.replace('$', '')?.replace(',', '');
    const sellerName = $(vehicleHTMLData).find('.seller-name')?.text()?.replace('/n', '')?.trim() || '';

    let images: string[] = [];
    try {
      images = $(vehicleHTMLData)
        .find('img.vehicle-image')
        .map((i, el) => $(el).attr('data-src'))
        .get();
    } catch (error) {
      _logger.log(`Error getting images for ${link}`);
      _logger.error(error);
    }

    const scrapedVehicle: ScrapedVehicle = {
      originalTitle: vehicle.name,
      link,
      description: vehicle.description,
      vin: vehicle.vehicleIdentificationNumber,
      title,
      year: solvedYear,
      make,
      model,
      trim: trimArray?.join(' '),
      mileage: +vehicle.mileageFromOdometer,
      sellerName,
      askingPrice: Number(askingPrice),
      listingDate: new Date().toISOString(),
      images,
      vehicleOriginalId: vehicleId,
      totalOwners: 0,
      sellerPhone: '',
      sellerEmail: '',
      suspectedDealer: false,
    };

    scrapedVehicles.push(scrapedVehicle);
    index++;
  }

  return scrapedVehicles;
};
