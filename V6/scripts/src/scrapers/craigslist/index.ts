import { DateTime } from 'luxon';
import { ExecutionStatus } from '../../shared/enums';
import {
  getParams,
  hasIgnoreTerm,
  randomSleep,
  removeUtf8EscapedCharacters,
  removeYears,
  sleep,
} from '../../shared/helpers';
import { Market, MarketParams, ScrapedVehicle, ScraperResults } from '../../shared/interfaces';
import { LogService, ScraperService } from '../../shared/services';
import {
  CaptchaStatus,
  CraigslistListing,
  CraigslistPostData,
  checkCaptchaStatus,
  filterDuplicatesByImage,
  getContactInformationData,
  getMarketUrl,
  solveCaptcha,
} from './craigslist-helper';
import { SCRAPER_DEFAULT_SETTINGS } from '../../shared';
import * as fs from 'fs';
import { PuppeteerLifeCycleEvent } from 'puppeteer';

/**
 * @description Execute the craigslist scraper
 * @param _market - The market to scrape
 * @param _logger - The logger service
 * @param _scraper - The scraper service
 *
 */
export const executeScraper = async (
  _market: Market,
  _logger: LogService,
  _scraper: ScraperService,
): Promise<ScraperResults> => {
  let retries = 3;
  let marketUrl: string;
  let craigslistParams: MarketParams;
  let totalResults: number;
  let totalPages: number;

  _logger.log(`Executing craigslist for market ${_market.id}`);

  try {
    craigslistParams = getParams(_market);
    marketUrl = getMarketUrl(_market, craigslistParams);
  } catch (error) {
    _logger.log(`Error getting market url for market ${_market.id}`);
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

  // Load the page at least 3 times
  do {
    try {
      retries--;
      // Navigate to the craigslist search link
      _logger.log(`Navigating to ${marketUrl}`);
      await _scraper.initScraper(marketUrl, false);
      await randomSleep();

      const linksData = await getLinks(_scraper);
      totalResults = linksData.totalResults;
      totalPages = linksData.totalPages;

      _logger.log(`Found ${totalResults} links for market ${_market.id} in ${totalPages} pages`);
      break;
    } catch (error) {
      if ((error.message.includes('net::ERR_TIMED_OUT') || error.message.includes('TimeoutError')) && retries > 0) {
        _logger.log(`Error loading page, retrying ${retries} more times`);
        await _scraper.closeScraper();
        await sleep(2000);
        continue;
      } else {
        _logger.log(`Error loading page, no more retries`);
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
    }
  } while (retries > 0);

  try {
    // Process the market

    await randomSleep();

    const skippedVehicles: ScrapedVehicle[] = [];
    const scrapedVehicles: ScrapedVehicle[] = [];

    const executionResults: ScraperResults = {
      success: true,
      executionStatus: ExecutionStatus.Success,
      executionMessage: '',
      totalVehicles: totalResults,
      skippedVehicles: 0,
      validVehicles: 0,
      results: [],
    };

    const maxResults = +process.env.SCRAPPER_MAX_RESULTS || SCRAPER_DEFAULT_SETTINGS.MAX_RESULTS;
    _logger.log(
      `Processing ${totalResults} vehicles in ${totalPages} pages, up to ${craigslistParams.daysSinceListed} days old and to a maximum of ${maxResults} vehicles`,
    );

    // Process each page
    for (let page = 0; page < totalPages; page++) {
      // Retry the page at least 3 times
      retries = 3;
      let links: string[] = [];

      do {
        try {
          await randomSleep();
          const pageUrl = `${marketUrl}&auto_title_status=1${page !== 0 ? `#search=1~gallery~${page}~0` : ''}`;

          // Navigate to the craigslist search link
          _logger.log(`Navigating to ${pageUrl}`);
          // TODO: CHANGE THIS BACK!!!! WE ARE JUST TESTING
          await _scraper.navigateToUrl(pageUrl, 10);
          await randomSleep(4000, 2000);

          // Reload the page if craigslist requires it
          const isReloading = await _scraper.currentPage.evaluate(() => {
            const reloadBtn = document.getElementById('#cl-unrecoverable-hard-refresh');
            if (reloadBtn) {
              reloadBtn?.click();
              return true;
            }
            return false;
          });

          if (isReloading) {
            await sleep(5000);
          }

          // Get the links for the page
          const linksData = await getLinks(_scraper);
          links = linksData.links;

          await randomSleep();
          break;
        } catch (error) {
          if (error.message.includes('net::ERR_TIMED_OUT') && retries > 0) {
            _logger.log(`Error loading page, retrying ${retries} more times`);
            continue;
          } else {
            _logger.log(`Error loading page, no more retries`);
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
        }
      } while (retries > 0);

      // Process each link
      const vehicles = await processLinks(links, _scraper, _logger);
      _logger.log(`Found ${vehicles?.length} vehicles for market ${_market.id} in page ${page}`);

      if (!vehicles || !vehicles?.length) {
        executionResults.skippedVehicles += links?.length || 0;
        continue;
      }

      let stopExecution = false;

      // Process vehicles
      for (const vehicleDetails of vehicles) {
        // Validate expiration date
        const expirationDate = DateTime.now().minus({ days: +craigslistParams.daysSinceListed });
        const listingDate = DateTime.fromISO(vehicleDetails.listingDate);
        if (listingDate < expirationDate) {
          _logger.log(`Vehicle ${vehicleDetails.vehicleOriginalId} is outside the expiration date`);
          _logger.log('Stopping execution due vehicles being outside the expiration date');
          stopExecution = true;
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
          stopExecution = true;
          break;
        }
      }

      if (stopExecution) {
        break;
      }
    }

    // Close the scraper
    await _scraper.closeScraper();

    // Save the results to a file
    if (!!+process.env.CRAIGSLIST_SAVE_RESULTS) {
      try {
        await fs.promises.mkdir('executions', { recursive: true });
        const millis = DateTime.now().toMillis();

        await fs.promises.writeFile(
          `executions/cl-results-${_market.dealershipGroup?.name} (${_market?.location})-${millis}.json`.toLowerCase(),
          JSON.stringify(scrapedVehicles, null, 2),
        );

        await fs.promises.writeFile(
          `executions/cl-skipped-${_market.dealershipGroup?.name} (${_market?.location})-${millis}.json`.toLowerCase(),
          JSON.stringify(skippedVehicles, null, 2),
        );
      } catch (e) {}
    }

    // Set the results
    executionResults.skippedVehicles = executionResults.totalVehicles - executionResults.validVehicles;

    // Filter possible duplicates
    executionResults.results = filterDuplicatesByImage(scrapedVehicles);

    return executionResults;
  } catch (error) {
    await sleep(10000);

    _logger.error(error);

    // Take a screenshot with the error
    await _scraper.takeScreenshot('craigslist-error');

    // Close the scraper
    await _scraper.closeScraper();

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
 * @description Get the links for the market search
 * @param _scraper - The scraper service
 * @returns The links for the market search
 */
const getLinks = async (_scraper: ScraperService) => {
  try {
    await _scraper.waitForSelector('ol > li');

    const resultLinks: { totalResultsText: string; links: string[] } = await _scraper.currentPage.evaluate(() => {
      const itemsSelector = 'ol > li';
      const items = Array.from(document.querySelectorAll(itemsSelector));

      const nodes = [];

      for (const item of items) {
        if (item.className === 'nearby-separator') {
          break;
        }

        nodes.push(item);
      }

      const totalResultsText = document.querySelector('.cl-page-number')?.innerHTML;

      return {
        links: nodes.reduce((acc, n) => {
          const link: string = n.querySelectorAll('a.main')?.[0]?.href;
          return link ? [...acc, link] : acc;
        }, [] as string[]),
        totalResultsText,
      };
    });

    // Get total results
    let totalResults = Number(resultLinks.totalResultsText?.split(' of ')?.[1]?.replace(',', ''));
    totalResults = isNaN(totalResults) ? 0 : totalResults;

    // Max results per page is 120
    const maxResults = 120;

    return {
      totalResults: totalResults,
      totalPages: Math.ceil(totalResults / maxResults),
      links: [...new Set(resultLinks.links)],
    };
  } catch (error) {
    throw new Error(`Error getting links: ${error.message}`);
  }
};

/**
 * @description Process the links
 * @param links - The links to process
 * @param _scraper - The scraper service
 * @param _logger - The logger service
 */
const processLinks = async (links: string[], _scraper: ScraperService, _logger: LogService) => {
  const vehicles: ScrapedVehicle[] = [];

  // Count the number of continuous errors
  let countContinuousErrors = 0;

  // Record the start time for the execution
  const startTime = process.hrtime();
  const maxExecutionTimeSeconds = 45 * 60; // 45 minutes in seconds
  const captchaStatus = new CaptchaStatus();

  if (links?.length) {
    for (const link of links) {
      try {
        await randomSleep(8000, 4000);

        // Navigate to the link
        await _scraper.navigateToUrl(link, 30, 'networkidle0' as PuppeteerLifeCycleEvent);
        _logger.log(`Processing link ${link}`);

        await randomSleep(8000, 4000);

        // Periodically check the elapsed time
        const elapsedTime = process.hrtime(startTime);
        const elapsedSeconds = elapsedTime[0] + elapsedTime[1] / 1e9;

        // Check if the execution time has exceeded the maximum allowed
        if (elapsedSeconds > maxExecutionTimeSeconds) {
          _logger.log(`Execution time exceeded the maximum allowed of ${maxExecutionTimeSeconds} seconds`);
          break;
        }

        let contactData = { email: '', phone: '', call: '' };

        if (process.env.CAPTCHA_SOLVER_API_KEY) {
          captchaStatus.reset();

          // Solve captcha
          await checkCaptchaStatus(
            _scraper.currentPage,
            captchaStatus.setCaptchaAsEnabled,
            captchaStatus.setCaptchaAsSolver,
          );
          await solveCaptcha(_scraper, link, captchaStatus, _logger);
          contactData = await getContactInformationData(_scraper, _logger);
        } else {
          _logger.log('No captcha solver API key found, skipping captcha solving');
        }

        // Gets the post details
        const data = await _scraper.currentPage.evaluate(() => {
          let post: CraigslistPostData = undefined;
          try {
            post = JSON.parse(document.getElementById('ld_posting_data')?.innerHTML) as CraigslistPostData;
          } catch (e) {
            console.log('There is not a valid JSON in the page under ld_posting_data');
            post = {
              image: [],
              description: document.getElementById('postingbody').textContent,
              offers: {
                price: (document.querySelector('.price')?.innerHTML || '')?.replace(/[^0-9]/g, ''),
              },
            };
          }

          return {
            post,
            originalTitle: document.getElementById('titletextonly')?.innerHTML || '',
            title:
              document.getElementsByClassName('attrgroup')?.[0]?.getElementsByTagName('span')?.[0]?.textContent || '',
            listingDate: document.getElementsByTagName('time')?.[0]?.attributes?.['datetime']?.value,
            attr: Array.from(document.getElementsByClassName('attrgroup')?.[1]?.getElementsByTagName?.('span'))?.map(
              (a) => a.textContent,
            ),
          };
        });

        // Get the vehicle details from the post
        const vehicleDetails = await getVehicleDetails({ ...data, contactData }, link);
        _logger.log(`Found vehicle ${vehicleDetails.vehicleOriginalId} - ${vehicleDetails.originalTitle}`);

        vehicles.push(vehicleDetails);
        countContinuousErrors = 0;
        await randomSleep();
      } catch (err) {
        _logger.log(`Error processing vehicle ${link}`);
        _logger.error(err);
        countContinuousErrors++;

        if (countContinuousErrors > 5) {
          _logger.log(`Too many errors in a row, there is something wrong with the execution`);
          break;
        }
      }
    }
  }

  return vehicles;
};

/**
 * @description Get the vehicle details
 * @param postDetails - The post details
 * @param link - The link
 * @returns The vehicle details
 */
const getVehicleDetails = async (postDetails: CraigslistListing, link: string) => {
  const onlyMakeModelTrimYearDetails = removeUtf8EscapedCharacters(postDetails.title || '');
  const [yearParts] = onlyMakeModelTrimYearDetails.trim().split(' ');
  const [makeParts, modelParts, ...trimParts] = removeYears(
    onlyMakeModelTrimYearDetails?.replace(/range\srover/gi, 'range-rover'),
  )
    .trim()
    .split(' ');

  const id = link.match(/\/(\d+)\.html$/)?.[1] || '';
  const year = Number(yearParts);
  const make = makeParts;
  const model = modelParts;
  const { contactData } = postDetails;
  const trim = trimParts?.join(' ')?.replace('Used', '')?.replace('undefined', '') || '';

  const title = `${year} ${make} ${model} ${trim}`?.trim();

  const images = postDetails.post?.image || [];

  const description = removeUtf8EscapedCharacters(postDetails.post?.description?.replace("'", '') || '');
  const askingPrice = Math.round(Number(postDetails.post?.offers?.price || 0));
  const listingDate = DateTime.fromISO(postDetails.listingDate).toUTC().toISO();

  const vinStr = postDetails?.attr.find((attr) => attr.includes('VIN'));
  const vin = vinStr ? vinStr.split(':')[1].trim() : null;

  const mileageStr = postDetails?.attr?.find((attr) => attr.includes('odometer'));
  const mileage = mileageStr ? Number(mileageStr.split(':')[1].trim()) : null;

  // TODO: Implement get Seller Name, Email and Phone

  return {
    vehicleOriginalId: id,
    title,
    originalTitle: postDetails.originalTitle,
    askingPrice,
    description,
    images,
    totalOwners: 0,
    mileage,
    sellerName: '',
    listingDate,
    year,
    make,
    model,
    trim,
    sellerPhone: contactData?.phone || contactData?.call || '',
    sellerEmail: contactData?.email || '',
    suspectedDealer: false,
    vin,
    link,
  };
};
