import { generate2FACode, randomSleep, sleep } from '../../shared/helpers';
import { CookieGenerationResults } from '../../shared/interfaces';
import { LogService, ScraperService } from '../../shared/services';
import * as fs from 'fs';
import { DateTime } from 'luxon';

const connectionResetError = 'net::ERR_CONNECTION_RESET';
const timeoutError = 'TimeoutError: Navigation Timeout Exceeded';

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

export const generateFacebookCookies = async (
  _logger: LogService,
  accounts: { name: string; password: string; twoFactorCode?: string }[],
): Promise<CookieGenerationResults> => {
  _logger.log('Generating facebook cookies');

  const cookies: { name: string; cookie: unknown }[] = [];

  _logger.log(`Passed ${accounts.length} accounts`);

  if (!accounts.length) {
    throw new Error('No accounts passed');
  }

  _logger.log('Initializing scraper');
  const _scraper: ScraperService = new ScraperService();

  for (const account of accounts) {
    try {
      await _scraper.initScraper('https://www.facebook.com/login/');
    } catch (error) {
      _logger.log('Error initializing scraper');
      _logger.error(error);
      cookies.push({ name: account.name, cookie: '' });
      continue;
    }
    let retries = 2;

    do {
      try {
        retries--;
        _logger.log('Using credentials to authenticate');
        await _scraper.typeText('#email', account.name);
        await _scraper.typeText('#pass', account.password);

        await _scraper.click('#loginbutton');
        await sleep(1000);

        await _scraper.waitForNavigation(10);

        // Validate that the user is logged in
        const currentUrl = await _scraper.getCurrentUrl();

        console.log('currentUrl', currentUrl);

        // Validate that the user is logged in
        await _scraper.takeScreenshot('facebook-login');

        // Two factor authentication
        if (currentUrl.indexOf('https://www.facebook.com/checkpoint/?next') > -1 && account.twoFactorCode) {
          await submitTwoFactorCode(_scraper, _logger);
        }

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

        const cookiesString = await _scraper.getCookies();
        cookies.push({ name: account.name, cookie: cookiesString ? JSON.stringify(cookiesString, null, 2) : '' });
        break;
      } catch (error) {
        if (
          (error.message.indexOf(connectionResetError) > -1 || error.message.indexOf(timeoutError) > -1) &&
          retries > 0
        ) {
          _logger.log('Connection reset error, retrying...');
          await _scraper.takeScreenshot('facebook-connection-reset-error');
          await _scraper.navigateToUrl('https://www.facebook.com/login');
          continue;
        }

        _logger.error(error);
        cookies.push({ name: account.name, cookie: '' });
      } finally {
        await _scraper.closeScraper();
      }
    } while (retries > 0);
  }

  // Save the results to a file
  if (!!+process.env.FACEBOOK_SAVE_COOKIES) {
    try {
      await fs.promises.mkdir('cookies', { recursive: true });
      const millis = DateTime.now().toMillis();

      await fs.promises.writeFile(`cookies/facebook-${millis}.json`.toLowerCase(), JSON.stringify(cookies, null, 2));
    } catch (e) {}
  }

  return {
    success: true,
    executionStatus: 'Success',
    executionMessage: '',
    results: cookies,
  };
};
