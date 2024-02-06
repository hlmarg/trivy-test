import { LogService, ScraperService } from '../../shared/services';
import { ScraperResults, Market, ScrapedVehicle } from '../../shared/interfaces';
import { ExecutionStatus } from '../../shared/enums';
import {
  generate2FACode,
  getParams,
  hasIgnoreTerm,
  randomSleep,
  removeUtf8EscapedCharacters,
  sleep,
} from '../../shared/helpers';
import { convertTotalOwnersStringToNumber, getFacebookRadius, getMarketUrl } from './facebook-helper';
import { DateTime } from 'luxon';
import * as fs from 'fs';
import { SCRAPER_DEFAULT_SETTINGS } from '../../shared';
import { findBestMatch } from 'string-similarity';

async function handleLoginError(error: Error, retries: number, _logger: LogService, _scraper: ScraperService) {
  if (retries > 0) {
    _logger.log('Retrying authentication');
  } else {
    _scraper.takeScreenshot('facebook-login-error');
    throw error;
  }
}

/**
 * @description Execute the facebook scraper
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
  try {
    if (!!+process.env.FACEBOOK_VPN_SERVICE) {
      try {
        await _scraper.initScraperWithVPN('https://www.facebook.com');
      } catch (e) {
        _logger.log('Error initializing scraper with VPN');
        _logger.error(e);
        throw new Error('VPN service is not available');
      }
    } else {
      // Verify facebook variables are set
      if (!process.env.FACEBOOK_USERNAME || !process.env.FACEBOOK_PASSWORD) {
        throw new Error('Facebook credentials not set');
      }

      _logger.log(`Executing facebook for market ${_market.id}`);

      // Verify that the page is loaded
      await _scraper.initScraper('https://www.facebook.com/login/');

      if (!+process.env.FACEBOOK_IGNORE_AUTH) {
        // Wait for the user to login
        let retries = 2;

        do {
          retries--;
          try {
            const success = await authenticate(_scraper, _logger);
            if (success) {
              break;
            }
          } catch (error) {
            const currentUrl = await _scraper.getCurrentUrl();
            // Retry if error is timeout
            if (error.message.indexOf('Navigation Timeout Exceeded') > -1) {
              handleLoginError(error, retries, _logger, _scraper);
            } else if (currentUrl.includes('login_attempt')) {
              _scraper.takeScreenshot('facebook-login-attempt');
              throw new Error(
                `There was an error logging into facebook with account ${process.env.FACEBOOK_USERNAME} - Cookies: ${_scraper.hasCookies}. Possible wrong credentials`,
              );
            } else {
              _scraper.takeScreenshot('facebook-login-error-unknown');
              throw error;
            }
          }
        } while (retries > 0);
      } else {
        _logger.log('Ignoring authentication');
      }
    }

    // Process the market
    const executionResults = await processMarket(_market, _logger, _scraper);

    // If results are 0 and there is the possibility of a soft block, return an error.
    if (executionResults?.totalVehicles === 0) {
      await _scraper.takeScreenshot('facebook-no-results');
      const errorMessage = !!+process.env.FACEBOOK_VPN_SERVICE
        ? 'No results found - Possible VPN block'
        : `No results found - ${
            +process.env.FACEBOOK_IGNORE_AUTH ? 'No Authentication' : process.env.FACEBOOK_USERNAME
          } - Possible soft block`;

      throw new Error(errorMessage);
    }

    // Close the scraper
    await _scraper.closeScraper();

    return executionResults;
  } catch (error) {
    await sleep(10000);

    _logger.error(error);

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
 * @description Authenticate the user with facebook
 * @param _scraper - The scraper service
 * @param _logger - The logger service
 *
 */
const authenticate = async (_scraper: ScraperService, _logger: LogService): Promise<boolean> => {
  _logger.log('Authenticating with facebook');
  let currentUrl: string;

  // Wait for the user to login
  await sleep(10000);

  _logger.log('Checking if the user is logged in');

  // Check if the cookies are set
  const currentCookies = process.env.FACEBOOK_COOKIE;
  if (currentCookies) {
    try {
      _logger.log('Parsing cookies');
      _scraper.saveCookies(JSON.parse(currentCookies));
    } catch (e) {
      _logger.log('Error parsing cookies');
      _logger.error(e);
    }
  }

  // Check if the user is logged in
  if (_scraper.hasCookies) {
    _logger.log('Using cookies to authenticate');
    await _scraper.setCookies(_scraper.currentCookies);
    await _scraper.takeScreenshot('facebook-cookies');
    await _scraper.navigateToUrl('https://www.facebook.com/login');
  } else {
    await _scraper.navigateToUrl('https://www.facebook.com/login');
    _logger.log('Using credentials to authenticate');
    await _scraper.typeText('#email', process.env.FACEBOOK_USERNAME);
    await _scraper.typeText('#pass', process.env.FACEBOOK_PASSWORD);

    await _scraper.click('#loginbutton');
    await sleep(1000);

    await _scraper.waitForNavigation(10);

    currentUrl = await _scraper.getCurrentUrl();

    if (currentUrl.indexOf('https://www.facebook.com/login') > -1) {
      throw new Error('There was an error logging into facebook with the provided credentials');
    }
  }

  _logger.log('Waiting for facebook to load');

  // Validate that the user is logged in
  currentUrl = await _scraper.getCurrentUrl();

  // Two factor authentication
  if (currentUrl.indexOf('https://www.facebook.com/checkpoint/?next') > -1 && process.env.FACEBOOK_TWO_FACTOR) {
    await submitTwoFactorCode(_scraper, _logger);
  }

  currentUrl = await _scraper.getCurrentUrl();

  // Validate that the user is logged in
  await _scraper.takeScreenshot('facebook-login');

  if (currentUrl.indexOf('https://www.facebook.com/login') > -1) {
    await _scraper.takeScreenshot('facebook-login-error');
    throw new Error(
      `There was an error logging into facebook with ${process.env.FACEBOOK_USERNAME} https://www.facebook.com/login - Cookies: ${_scraper.hasCookies}`,
    );
  }

  if (currentUrl.indexOf('https://www.facebook.com/checkpoint') > -1) {
    await _scraper.takeScreenshot('facebook-checkpoint-error');
    throw new Error(
      `There was an error logging into facebook with ${process.env.FACEBOOK_USERNAME} https://www.facebook.com/checkpoint - Cookies: ${_scraper.hasCookies}`,
    );
  }

  if (currentUrl.indexOf('https://www.facebook.com/recover') > -1) {
    await _scraper.takeScreenshot('facebook-recover-error');
    throw new Error(
      `There was an error logging into facebook with ${process.env.FACEBOOK_USERNAME} https://www.facebook.com/recover - Cookies: ${_scraper.hasCookies}`,
    );
  }

  // Save the cookies for future use
  const cookies = await _scraper.getCookies();
  await _scraper.saveCookies(cookies);

  return true;
};

/**
 * @description Submit the two factor authentication code
 * @param _scraper - The scraper service
 * @param _logger - The logger service
 */
const submitTwoFactorCode = async (_scraper: ScraperService, _logger: LogService) => {
  _logger.log('Two factor authentication required');

  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    let generatedCode = '';

    try {
      _logger.log('Generating two factor authentication code');
      generatedCode = generate2FACode(process.env.FACEBOOK_TWO_FACTOR);
    } catch (e) {
      _logger.log('Error generating two factor authentication code');
      _logger.error(e);
      await _scraper.takeScreenshot('facebook-two-factor-error');
      throw new Error(
        `There was an error logging into facebook with ${process.env.FACEBOOK_USERNAME} and two factor authentication code`,
      );
    }

    if (generatedCode) {
      await _scraper.typeText('#approvals_code', generatedCode);

      await _scraper.click('#checkpointSubmitButton');
      await _scraper.waitForNavigation(10);
      await randomSleep();

      if (!(await _scraper.isElementVisible('#approvals_code'))) {
        _logger.log('Save browser with two factor authentication');
        await _scraper.click('#checkpointSubmitButton');
        await _scraper.waitForNavigation(10);
        await randomSleep();
      } else {
        _logger.log('Two factor authentication code is invalid, trying again');
        attempts++;
        continue;
      }

      try {
        let currentReviewLoginTries = 0;

        // Handles the "This was me" and "Review Recent Login" screen
        while (currentReviewLoginTries < 5) {
          const pageUrl = await _scraper.getCurrentUrl();
          if (pageUrl.indexOf('https://www.facebook.com/checkpoint/?next') > -1) {
            _logger.log('Review recent login...');
            await randomSleep();

            await _scraper.click('#checkpointSubmitButton');
            await _scraper.waitForNavigation(10);
          } else {
            _logger.log('On a different screen than expected, continuing...');
            await _scraper.takeScreenshot('facebook-two-factor-different-screen');
            await _scraper.navigateToUrl('https://www.facebook.com/login');
            return;
          }

          currentReviewLoginTries++;
          await randomSleep();
        }
      } catch (e) {
        console.log('Error handling the review login screen', e);
      }
    }

    attempts++;
  }

  await _scraper.takeScreenshot('facebook-two-factor-before-login');
  await _scraper.navigateToUrl('https://www.facebook.com/login');
};

/**
 * @description Process the market
 * @param _market - The market to process
 * @param _logger - The logger service
 * @param _scraper - The scraper service
 * @returns The scraper results
 */
const processMarket = async (
  _market: Market,
  _logger: LogService,
  _scraper: ScraperService,
): Promise<ScraperResults> => {
  // Record the start time for the execution
  const startTime = process.hrtime();
  const maxExecutionTimeSeconds = 45 * 60; // 45 minutes in seconds

  const executionResults: ScraperResults = {
    success: true,
    executionStatus: ExecutionStatus.Success,
    executionMessage: '',
    totalVehicles: 0,
    skippedVehicles: 0,
    validVehicles: 0,
    results: [],
  };

  await sleep(1000);
  await randomSleep();

  // Set the parameters
  const params = getParams(_market);

  // Get the facebook search link
  const facebookMarketUrl = getMarketUrl(_market, params);

  // Navigate to the facebook search link
  _logger.log(`Navigating to ${facebookMarketUrl}`);
  await _scraper.navigateToUrl(facebookMarketUrl, 360);
  await randomSleep();

  await clearPageBlock(_scraper);
  await randomSleep();

  // Radius
  const facebookRadius = getFacebookRadius(params.searchRadius);
  await randomSleep();

  // Set the radius
  try {
    _logger.log(`Setting the search radius to ${facebookRadius.value} miles`);
    await _scraper.currentPage.evaluate(async (radiusIndex) => {
      async function setRadius(radiusIndex: number) {
        document.querySelectorAll('[id="seo_filters"]')?.[0]?.querySelectorAll('div')?.[0].click();
        await new Promise((resolve) => setTimeout(resolve, 10000));

        document.querySelectorAll<HTMLButtonElement>('label[aria-label="Radius"]')?.[0]?.click();
        await new Promise((resolve) => setTimeout(resolve, 5000));

        document
          .querySelectorAll('div[role="listbox"]')?.[0]
          ?.querySelectorAll<HTMLButtonElement>('div[role="option"')
          ?.[radiusIndex]?.click();
        await new Promise((resolve) => setTimeout(resolve, 5000));

        document.querySelectorAll<HTMLButtonElement>('div[aria-label="Apply"]')?.[0]?.click();
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }

      await setRadius(radiusIndex);
    }, facebookRadius.index);
  } catch (e) {
    _logger.error(e);
    await _scraper.takeScreenshot('facebook-radius-error');
    throw new Error('Unable to set the search radius');
  }

  await randomSleep();

  // Take a screenshot
  await _scraper.takeScreenshot(`facebook-search-results-market-${_market.id}`);

  // Scroll to the bottom based on the env variable
  if (!!+process.env.FACEBOOK_SCROLL_TO_BOTTOM) {
    _logger.log('Scrolling to the bottom of the page');
    await _scraper.scrollToBottom();
  }

  await randomSleep();

  // Take a screenshot
  await _scraper.takeScreenshot(`facebook-search-results-market-${_market.id}`);

  // Get the vehicle links
  const links = await _scraper.currentPage.evaluate((selector: string) => {
    const links = document.querySelectorAll<HTMLLinkElement>(selector);
    const linksArray = Array.from(links).map((link) => link.href);
    return linksArray;
  }, 'a.x1i10hfl.xjbqb8w.x6umtig.x1b1mbwd.xaqea5y.xav7gou.x9f619.x1ypdohk.xt0psk2.xe8uvvx.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.xexx8yu.x4uap5.x18d9i69.xkhd6sd.x16tdsg8.x1hl2dhg.xggy1nq.x1a2a7pz.x1heor9g.x1lku1pv');

  _logger.log(`Found ${links.length} vehicles on the page`);
  await randomSleep();

  if (links.length === 0) {
    _logger.log('No vehicles found on the page');
    return executionResults;
  }

  const maxResults = +process.env.FACEBOOK_MAX_RESULTS || SCRAPER_DEFAULT_SETTINGS.MAX_RESULTS;
  _logger.log(
    `Processing ${links.length} vehicles up to ${params.daysSinceListed} days old and to a maximum of ${maxResults} vehicles`,
  );
  executionResults.totalVehicles = links.length;

  const scrapedVehicles: ScrapedVehicle[] = [];
  const skippedVehicles: ScrapedVehicle[] = [];

  let countContinuousErrors = 0;

  // Processing each link
  for (const link of links) {
    try {
      await randomSleep();

      // Periodically check the elapsed time
      const elapsedTime = process.hrtime(startTime);
      const elapsedSeconds = elapsedTime[0] + elapsedTime[1] / 1e9;

      // Check if the execution time has exceeded the maximum allowed
      if (elapsedSeconds > maxExecutionTimeSeconds) {
        _logger.log(`Execution time exceeded the maximum allowed of ${maxExecutionTimeSeconds} seconds`);
        break;
      }

      await randomSleep();

      // Get the vehicle details
      const vehicleDetails = await getVehicleDetails(_scraper, _logger, link);
      _logger.log(`Found vehicle ${vehicleDetails.vehicleOriginalId} - ${vehicleDetails.originalTitle}`);
      countContinuousErrors = 0;

      await randomSleep();

      // Validate expiration date
      const expirationDate = DateTime.now().minus({ days: +params.daysSinceListed });
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
    } catch (err) {
      _logger.log(`Error processing vehicle ${link}`);
      _logger.error(err);
      executionResults.skippedVehicles++;
      countContinuousErrors++;

      if (countContinuousErrors > 5) {
        _logger.log(`Too many errors in a row, there is something wrong with the execution`);
        break;
      }
    }
  }

  // Save the results to a file
  if (!!+process.env.FACEBOOK_SAVE_RESULTS) {
    try {
      await fs.promises.mkdir('executions', { recursive: true });
      const millis = DateTime.now().toMillis();

      await fs.promises.writeFile(
        `executions/results-${_market.dealershipGroup?.name} (${_market?.location})-${millis}.json`.toLowerCase(),
        JSON.stringify(scrapedVehicles, null, 2),
      );

      await fs.promises.writeFile(
        `executions/skipped-${_market.dealershipGroup?.name} (${_market?.location})-${millis}.json`.toLowerCase(),
        JSON.stringify(skippedVehicles, null, 2),
      );
    } catch (e) {}
  }

  // Set the results
  executionResults.skippedVehicles = links.length - executionResults.validVehicles;
  executionResults.results = scrapedVehicles;

  return executionResults;
};

/**
 * @description Clear the page block
 * @param _scraper - The scraper service
 *
 */
const clearPageBlock = async (_scraper: ScraperService) => {
  try {
    await _scraper.click('.__fb-light-mode.x1n2onr6.x1vjfegm');
  } catch (err) {
    // console.log('There was an error removing the blocks');
  }
};

/**
 * @description Get the vehicle details
 * @param _scraper - The scraper service
 * @param _logger - The logger service
 * @param _link - The vehicle link
 * @returns The scraped vehicle
 */
const getVehicleDetails = async (
  _scraper: ScraperService,
  _logger: LogService,
  _link: string,
): Promise<ScrapedVehicle> => {
  // Visit the vehicle link
  await _scraper.navigateToUrl(_link);
  await randomSleep();

  // Clear the page block
  await clearPageBlock(_scraper);
  await randomSleep();

  // Get the vehicle details
  const productHtml = await _scraper.currentPage.evaluate(() => document.body.outerHTML);

  // Save the HTML to a file
  if (!!+process.env.FACEBOOK_SAVE_PRODUCT_HTML) {
    try {
      await fs.promises.mkdir('html', { recursive: true });
      await fs.promises.writeFile('html/product.html', productHtml);
    } catch (e) {}
  }

  let suspectedDealer = false;

  // Extract vehicle ID from the link
  const id = _link.match(/https:\/\/www\.facebook\.com\/marketplace\/item\/([^/]+)/)?.[1];

  // Extract original title
  const originalTitle =
    removeUtf8EscapedCharacters(new RegExp(`"marketplace_listing_title":"([^"]+)","id":"${id}"`).exec(productHtml)?.[1])
      ?.replace(/\s+/g, ' ')
      ?.trim() || '';

  // Extract price
  const askingPrice = Number(
    /"listing_price":{"amount_with_offset":"(.*?)","currency":"USD","amount":"(.*?)"/gm
      .exec(productHtml)?.[2]
      ?.trim() || '',
  );

  // Description
  let description =
    removeUtf8EscapedCharacters(
      /"redacted_description":{"text":"(.*?)"}/gm.exec(productHtml)?.[1]?.replace("'", '')?.trim(),
    ) || '';

  // Extract listing photos
  let listingPhotos: any[] = [];
  try {
    listingPhotos = JSON.parse(/"listing_photos":(\[.*?\])/gm.exec(productHtml)?.[1]).map((item: any) => ({
      url: item.image.uri,
      caption: item.accessibility_caption,
    }));
    if (listingPhotos?.some((photo: { caption: string }) => photo.caption?.toLowerCase().indexOf('dealer') > -1)) {
      suspectedDealer = true;
    }
  } catch (e) {
    _logger.log('Error parsing listing photos');
    _logger.error(e);
  }

  // Total owners
  const totalOwners = convertTotalOwnersStringToNumber(
    /"vehicle_number_of_owners":"(.*?)"/gm.exec(productHtml)?.[1]?.trim(),
  );

  // Mileage
  const mileage = Number(/"vehicle_odometer_data":{"unit":"MILES","value":(.*?)}/gm.exec(productHtml)?.[1]?.trim());

  // Seller name
  const sellerName = removeUtf8EscapedCharacters(
    /"actors":\[{"__typename":"User","name":"(.*?)"/gm.exec(productHtml)?.[1]?.trim(),
  )?.trim();

  // Dealership Name
  const dealerName = /"dealership_name":"(.*?)","seller":{"/gm.exec(productHtml)?.[1]?.trim() || '';
  if (!!dealerName) {
    suspectedDealer = true;
  }

  // Vehicle seller type
  const sellerType = /"vehicle_seller_type":"(.*?)"/gm.exec(productHtml)?.[1]?.trim();
  if (sellerType !== 'PRIVATE_SELLER') {
    suspectedDealer = true;
  }

  // Listing date
  const listingTime = /"creation_time":([0-9]*)/gm.exec(productHtml)?.[1]?.trim();
  const listingDate = DateTime.fromMillis(Number(listingTime) * 1000).toISO();

  // Year, make, model and trim
  const year = +originalTitle.trim().split(' ')?.[0]?.trim();

  const make = removeUtf8EscapedCharacters(
    /"vehicle_make_display_name":"(.*?)"/gm.exec(productHtml)?.[1]?.trim(),
  )?.trim();

  const model = removeUtf8EscapedCharacters(
    /"vehicle_model_display_name":"(.*?)"/gm.exec(productHtml)?.[1]?.trim(),
  )?.trim();

  const trim =
    removeUtf8EscapedCharacters(/"vehicle_trim_display_name":"(.*?)"/gm.exec(productHtml)?.[1]?.trim())?.trim() || '';

  // Contains hidden information
  if (description.match(/.*\[hidden information\].*/i)) {
    // _logger.log('This feature is disabled temporarily');
    description = description.replace(/\[hidden information\]/gi, '');
    // TODO: Enable this feature once the mobile website is working again.
    _logger.log(`Getting new description from mobile website for ${id}`);
    const newDescription = await getMobileDescription(_scraper, id, description);
    if (newDescription) {
      description = newDescription;
    }
  }

  // Ensure to return or process the extracted data as needed
  return {
    vehicleOriginalId: id,
    title: `${year} ${make} ${model} ${trim}`,
    originalTitle,
    askingPrice,
    description,
    images: listingPhotos.map((photo: { url: string }) => photo.url),
    totalOwners,
    mileage,
    sellerName,
    listingDate,
    year,
    make,
    model,
    trim,
    sellerPhone: '',
    sellerEmail: '',
    suspectedDealer,
    vin: '',
    link: _link?.split('?')?.[0],
  };
};

/**
 * @description Get the description with the phone number from the mobile site on facebook
 * @param _scraper - The scraper service
 * @param id - The vehicle id
 * @param currentDescription - The hidden information
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getMobileDescription = async (
  _scraper: ScraperService,
  id: string,
  currentDescription: string,
): Promise<string> => {
  try {
    await randomSleep();
    await _scraper.navigateToUrl(`https://m.facebook.com/marketplace/item/${id}`, 160000);

    await randomSleep();

    const documentContent = await _scraper.currentPage.evaluate(() => document.body.outerHTML);

    const stringForBestMatch = currentDescription?.replace('[hidden information]', '');
    const phoneRegex = new RegExp('<div class="_59k _2rgt _1j-f _2rgt"[^>]* data-nt="FB:TEXT4">(.*?)</div>', 'gi');
    const phoneMatchString = documentContent?.matchAll(phoneRegex);

    if (!phoneMatchString) {
      console.log('No phone number found with the phoneRegex');
      return currentDescription;
    }

    const compareOptions = Array.from(phoneMatchString || [])?.map((match) => {
      return removeUtf8EscapedCharacters(
        match?.[1]
          ?.replace('/<brs*/?>/gi', '\n')
          ?.replace(/<[^>]*>/g, ' ')
          .trim(),
      );
    });

    if (!compareOptions || compareOptions.length === 0 || !stringForBestMatch) {
      console.log('No phone number found with the phoneRegex');
      return currentDescription;
    }

    return findBestMatch(stringForBestMatch, compareOptions)?.bestMatch?.target;
  } catch (e) {
    console.log('Error getting the mobile description');
    console.log(e);
  }

  return '';
};
