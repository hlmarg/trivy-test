import { LogService, ScraperService } from 'src/shared/services';
import { MarketSettingsTypes, MarketVehiclesType } from '../../shared/enums';
import { getMarketSettings, randomSleep, sleep } from '../../shared/helpers';
import { Market, ScrapedVehicle, MarketParams } from '../../shared/interfaces';
import axios from 'axios';
import { Page } from 'puppeteer';

/**
 * @description Get the market search link
 * @param _market - The market to get the link for
 * @returns The craigslist search link
 */
export const getMarketUrl = (_market: Market, params?: MarketParams): string => {
  // Get the craigslist location
  const marketCraigslistLocation = getMarketSettings(
    MarketSettingsTypes.CraigslistLocation,
    _market.marketSettings,
  )?.replace(/\/$/, '');

  if (!marketCraigslistLocation) {
    throw new Error(`Craigslist location not found for market ${_market.id}`);
  }

  let type = '';
  switch (_market.vehiclesType) {
    case MarketVehiclesType.RV:
      type = 'rva';
      break;
    default: {
      type = 'cta';
      break;
    }
  }

  const url = `https://${marketCraigslistLocation}.craigslist.org/search/${type}`;

  const urlParams = new URLSearchParams({
    min_price: params.minPrice,
    max_price: params.maxPrice,
    max_auto_miles: params.maxMileage,
    max_auto_year: params.maxYear,
    min_auto_year: params.minYear,
    search_distance: params.searchRadius,
    daysSinceListed: params.daysSinceListed,
    postal: _market.zipCode,
    sortBy: 'date',
    srchType: 'T',
    searchNearby: 1,
    purveyor: 'owner',
    bundleDuplicates: 1,
  } as any);

  return `${url}?${new URLSearchParams(urlParams).toString()}&auto_title_status=1&auto_title_status=5`;
};

/**
 * @description Filter vehicles that are duplicated by checking the first image to make sure is unique
 * @param vehicles - The vehicles to filter
 * @returns The filtered vehicles
 */
export const filterDuplicatesByImage = (vehicles: ScrapedVehicle[]) => {
  const filteredVehicles: ScrapedVehicle[] = [];
  const firstImageSet = new Set();

  vehicles.forEach((vehicle) => {
    const firstImage = vehicle.images?.[0];
    if (!firstImage) {
      filteredVehicles.push(vehicle);
    } else if (!firstImageSet.has(firstImage)) {
      filteredVehicles.push(vehicle);
      firstImageSet.add(firstImage);
    }
  });

  return filteredVehicles;
};

async function clickOnCaptchaImages(puppeteer: ScraperService, solution: boolean[]) {
  const iframeSelector = 'iframe[title="Main content of the hCaptcha challenge"]';
  const iframeElementHandle = await puppeteer.currentPage.$(iframeSelector);

  const iframeContent = await iframeElementHandle.contentFrame();

  const images = await iframeContent.$$('.task-grid .task');

  await sleep(1000);

  for (let i = 0; i < solution.length; i++) {
    if (solution[i]) {
      await images[i].click();
      await sleep(300);
    }
  }

  // Click on next or Verify using the class name
  await iframeContent.click('.button-submit.button');
  await sleep(1000);
}

/**
 * @description Listen for requests to check if captcha is enabled or solved
 */
export async function checkCaptchaStatus(
  page: Page,
  captchaIsEnabledCallback: () => void,
  captchaIsSolvedCallback: () => void,
) {
  await page.on('request', (request) => {
    if (request.url().includes('hcaptcha')) {
      captchaIsEnabledCallback();
    }

    if (request.url().includes('popup')) {
      captchaIsSolvedCallback();
    }
  });
}

export class CaptchaStatus {
  public captchaIsEnabled: boolean;
  public captchaIsSolved: boolean;

  constructor() {
    this.captchaIsEnabled = false;
    this.captchaIsSolved = false;

    this.setCaptchaAsEnabled = this.setCaptchaAsEnabled.bind(this);
    this.setCaptchaAsSolver = this.setCaptchaAsSolver.bind(this);
    this.reset = this.reset.bind(this);
  }

  setCaptchaAsEnabled() {
    this.captchaIsEnabled = true;
  }

  setCaptchaAsSolver() {
    this.captchaIsSolved = true;
  }

  reset() {
    this.captchaIsEnabled = false;
    this.captchaIsSolved = false;
  }
}

export async function solveCaptcha(
  scraper: ScraperService,
  url: string,
  captchaStatus: CaptchaStatus,
  logger: LogService,
) {
  sleep(3000);

  const captchaAPIKey = process.env.CAPTCHA_SOLVER_API_KEY;

  // We need some retries in case of we cannot solve the captcha, because the captcha is not the same captcha type all the time.

  await randomSleep(1200, 700);

  await scraper.waitForSelector('.reply-button');
  await scraper.click('.reply-button');

  await sleep(4000);
  logger.log(`CaptchaStatus: ${captchaStatus.captchaIsEnabled} ${captchaStatus.captchaIsSolved}`);

  while (captchaStatus.captchaIsEnabled && !captchaStatus.captchaIsSolved) {
    await sleep(4000);
    const { question, images } = await getCaptchaQuestionData(scraper, logger);

    logger.log(`Trying to solve captchaQuestion: ${question}`);

    let task;

    try {
      if (!question || images.length === 0) {
        const error = new Error('Captcha question or images not found');
        logger.error(error);
        throw error;
      }

      // Check the docs for more information https://docs.capsolver.com/guide/recognition/HCaptchaClassification.html
      task = await axios.post('https://api.capsolver.com/createTask', {
        clientKey: captchaAPIKey,
        task: {
          type: 'HCaptchaClassification',
          websiteURL: url,
          question: question, // Get this from the iframe
          queries: images,
        },
      });

      logger.log('Captcha is solved');
    } catch (error) {
      logger.log('Captcha is not solved');
      logger.error(error?.response?.data || error);
      refreshCaptcha(scraper, logger);
      continue;
    }

    // Separate the solution into 2 arrays of 9 elements each. Solution
    const solution = task?.data?.solution?.objects;

    if (!solution) {
      break;
    }

    // click on the images based on the arrays.
    await clickOnCaptchaImages(scraper, solution);
    await sleep(500);
  }
}

export async function refreshCaptcha(scraper: ScraperService, logger: LogService) {
  try {
    const iframeSelector = 'iframe[title="Main content of the hCaptcha challenge"]';
    const iframeElementHandle = await scraper.currentPage.$(iframeSelector);

    const iframeContent = await iframeElementHandle?.contentFrame();
    const buttonSelector = '.refresh.button';

    await iframeContent?.click(buttonSelector);
  } catch (error) {
    logger.error(error);
    await scraper.currentPage.reload();
  }
}

export async function getCaptchaQuestionData(scraper: ScraperService, logger: LogService) {
  // Navigate to a page containing an iframe
  let title: string | null;
  const images: string[] = [];
  // Identify the iframe element using a selector
  const iframeSelector = 'iframe[title="Main content of the hCaptcha challenge"]';
  const iframeElementHandle = await scraper.currentPage.$(iframeSelector);

  if (iframeElementHandle) {
    // Switch Puppeteer's context to the iframe
    const iframeContent = await iframeElementHandle.contentFrame();

    // Now you can interact with elements inside the iframe
    const elementInsideIframeSelector = '.challenge-header .prompt-text span';
    const elementInsideIframe = await iframeContent.$(elementInsideIframeSelector);

    if (elementInsideIframe) {
      // Perform actions on the element inside the iframe
      title = await elementInsideIframe.evaluate((el) => el.textContent);
    } else {
      logger.log('Element inside iframe not found');
    }

    const imagesElements = await iframeContent.$$('.task-grid .task .task-image .image');

    for (const image of imagesElements) {
      const style = await image.evaluate((el) => el.getAttribute('style'));
      const url = style.match(/url\("(.*)"\)/)[1];
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const base64 = Buffer.from(response.data, 'binary').toString('base64');
      images.push(base64);
    }
  } else {
    logger.log('Iframe not found');
  }

  logger.log(`Captcha question successfully scraped: ${title}`);

  if (title?.includes('furniture')) {
    // INFO:
    // It seems like the captcha solver service is an AI model prepared to solve specific questions.
    // It looks like hCaptcha is using the same captcha but the changed the question, so for that reason we need to replace the question.
    logger.log('Replacing question');
    title = 'Please click each image containing a chair';
  }

  return { question: title, images };
}

export async function getContactInformationData(scraper: ScraperService, logger: LogService) {
  try {
    await scraper.waitForSelector('.reply-option-header');
  } catch (error) {
    logger.log('Captcha is not solved');
    return null;
  }

  await scraper.click('.reply-option-header');

  await scraper.waitForSelector('.reply-email-localpart');

  const emailText = await scraper.currentPage.evaluate(() => {
    return document.querySelector('.reply-email-localpart')?.textContent;
  });

  const callText = await scraper.currentPage.evaluate(() => {
    return document.querySelector('.reply-content-phone')?.textContent;
  });

  const phoneText = await scraper.currentPage.evaluate(() => {
    return document.querySelector('.reply-content-text')?.textContent;
  });

  logger.log(`Contact Information successfully scraped: ${emailText} ${callText} ${phoneText}`);

  // Email only contains the local part, we need to add the domain
  return {
    email: `${emailText}@sale.craigslist.org`,
    phone: phoneText,
    call: callText,
  };
}

export interface CraigslistPostData {
  image?: string[];
  description?: string;
  offers: {
    price: string;
  };
}

export interface CraigslistListing {
  post: CraigslistPostData;
  originalTitle: string;
  title: string;
  listingDate: string;
  contactData: {
    email: string;
    phone: string;
    call: string;
  };
  attr: string[];
}
