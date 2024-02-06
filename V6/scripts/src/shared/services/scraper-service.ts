import { Browser, Page, PuppeteerLaunchOptions, PuppeteerLifeCycleEvent, executablePath } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import adBlocker from 'puppeteer-extra-plugin-adblocker';
import * as fs from 'fs';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

export class ScraperService {
  private _browser: Browser;
  private _page: Page;
  private _currentCookies: unknown[];
  private _defaultTimeout = +process.env.PUPPETEER_TIMEOUT || 160000;
  private _proxyURL = '';
  private _vpnInitiated = false;

  /**
   * @description Check if the scraper has cookies
   * @returns True if the scraper has cookies
   */
  get hasCookies() {
    return !!this._currentCookies;
  }

  /**
   * @description Get the current cookies
   * @returns The current cookies
   */
  get currentCookies() {
    return this._currentCookies;
  }

  /**
   * @description Initialize the scraper
   * @param baseUrl - The base url to navigate to
   * @returns The page object
   */
  async initScraper(baseUrl: string, useProxy = false) {
    // If the browser or page is not defined, create a new one
    if (!this._browser || !this._page) {
      // Add protections against bot detection
      puppeteer.use(stealthPlugin());

      // Add ad blocker to block trackers and ads
      const addBlocker = adBlocker({
        blockTrackers: true,
      });
      puppeteer.use(addBlocker);

      // Default incognito browser context
      const launchOptions: PuppeteerLaunchOptions = {
        headless: !+process.env.DEBUG_PUPPETEER,
        ignoreHTTPSErrors: true,
        devtools: false,
        executablePath: executablePath(),
        args: [
          '--incognito',
          '--no-sandbox',
          '--disable-gpu',
          '--disable-notifications',
          '--disable-accelerated-2d-canvas',
          '--lang=en-US,en',
          '--shm-size=1gb',
        ],
        ignoreDefaultArgs: ['--disable-extensions', '--enable-automation'],
        protocolTimeout: 300000,
      };

      if (useProxy && this._proxyURL) {
        launchOptions.args.push(`--proxy-server=${process.env.SCRAPER_PROXY_URL}:10001`);
        launchOptions.args.push(`--proxy-auth=${process.env.SCRAPER_VPN_USER}:${process.env.SCRAPER_VPN_PASSWORD}`);
      }

      this._browser = await puppeteer.launch(launchOptions);
      const context = await this._browser.createIncognitoBrowserContext();
      this._page = await context.newPage();
      this._page.setDefaultNavigationTimeout(this._defaultTimeout);
      this._page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0');

      if (useProxy && this._proxyURL) {
        this._page.authenticate({
          username: process.env.SCRAPER_VPN_USER,
          password: process.env.SCRAPER_VPN_PASSWORD,
        });
      }
    }

    await this._page.goto(baseUrl, { waitUntil: 'networkidle2' });

    return this._page;
  }

  /**
   * @description Initialize the scraper
   * @param baseUrl - The base url to navigate to
   * @returns The page object
   */
  async initScraperWithVPN(baseUrl: string) {
    if (!this._vpnInitiated) {
      // Authenticate VPN
      const success = await this.authenticateVPN();

      if (!success) {
        throw new Error('Failed to authenticate VPN');
      }
    }

    return await this.initScraper(baseUrl, true);
  }

  /**
   * @description Authenticate the VPN. Supports only the proxy service 'StarProxy' using the socks5 protocol.
   * @returns True if the authentication was successful
   */
  async authenticateVPN() {
    // Validate environment variables
    if (!process.env.SCRAPER_VPN_USER || !process.env.SCRAPER_VPN_PASSWORD || !process.env.SCRAPER_PROXY_URL) {
      throw new Error('Missing environment variables for VPN authentication');
    }

    try {
      const username = process.env.SCRAPER_VPN_USER;
      const password = process.env.SCRAPER_VPN_PASSWORD;
      const url = process.env.SCRAPER_PROXY_URL;
      const port = 9000;
      this._proxyURL = `https://${username}:${password}@${url}:${port}`;

      console.log(`Proxy URL: ${this._proxyURL}`);

      console.log('Checking IP address...');

      const oldIPResponse = await axios.get('https://api.ipify.org?format=json');
      console.log(`Current IP address: ${oldIPResponse?.data?.ip}`);

      const agent = new HttpsProxyAgent(this._proxyURL);
      const customHeaders = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
      };

      const myIPResponse = await axios.get('https://api.ipify.org?format=json', {
        httpAgent: agent,
        httpsAgent: agent,
        headers: customHeaders,
      });

      console.log(`New IP address: ${myIPResponse?.data?.ip}`);
    } catch (error) {
      console.error(`Failed to get IP address: ${error?.message ?? error}`);
    }

    return true;
  }

  /**
   * @description Close the scraper and browser instances
   */
  async closeScraper() {
    try {
      if (this._page) {
        await this._page.close();
      }

      if (this._browser) {
        await this._browser.close();
      }

      this._page = null;
      this._browser = null;
    } catch (err) {
      console.log('There was an error closing the browser', err);
    }
  }

  /**
   * @description Navigate to a url
   * @param url - The url to navigate to
   * @param timeout - The timeout for the navigation on seconds
   * @returns The page object
   */
  async navigateToUrl(url: string, timeout?: number, waitUntil = 'networkidle2' as PuppeteerLifeCycleEvent) {
    timeout
      ? await this._page.goto(url, { waitUntil, timeout: timeout * 1000 })
      : await this._page.goto(url, { waitUntil });
  }

  /**
   * @description Type text into an input
   * @param selector - The selector of the input
   * @param text - The text to type
   * @param delay - The delay between each keypress
   */
  async typeText(selector: string, text: string, delay = 80) {
    await this._page?.type(selector, text, { delay });
  }

  /**
   * @description Click an element
   * @param selector - The selector of the element
   */
  async click(selector: string) {
    await this._page?.click(selector);
  }

  /**
   * @description Wait for the page to load
   * @param timeout - The timeout for the navigation on seconds
   * @param throwError - Throw an error if the page fails to load
   */
  async waitForNavigation(timeout: number = this._defaultTimeout, throwError = false) {
    try {
      timeout
        ? await this._page?.waitForNavigation({ waitUntil: 'networkidle2', timeout: timeout * 1000 })
        : await this._page?.waitForNavigation({ waitUntil: 'networkidle2' });
    } catch (err) {
      console.log('There was an error waiting for navigation', err);
      if (throwError) {
        throw err;
      }
    }
  }

  /**
   * @description Wait for a selector to load
   * @param selector - The selector to wait for
   */
  async waitForSelector(selector: string) {
    await this._page?.waitForSelector(selector);
  }

  /**
   * @description Get the current url of the page
   * @returns The current url
   */
  async getCurrentUrl() {
    return this._page?.url();
  }

  /**
   * @description Get the cookies from the page
   * @returns The cookies
   */
  async getCookies() {
    return this._page?.cookies();
  }

  /**
   * @description Set the cookies for the page
   * @param cookies - The cookies to set
   */
  async setCookies(cookies: unknown[]) {
    await this._page?.setCookie(...(cookies as any));
  }

  /**
   * @description Save the current cookies for future use
   * @param cookies - The cookies to save
   */
  async saveCookies(cookies: unknown[]) {
    this._currentCookies = cookies;
  }

  /**
   * @description Get the current page
   * @returns The current page
   */
  get currentPage(): Page {
    return this._page;
  }

  /**
   * @description Scroll to the bottom of the page
   * @param scrollStep - The amount to scroll each time
   * @param maxScrollInterval - The max interval between each scroll in ms
   * @param maxWaitTime - The maximum amount of time to wait for new content to load
   *
   * @returns True if the scroll was successful
   */
  async scrollToBottom(scrollStep = 50, maxScrollInterval = 100, maxWaitTime = 9000) {
    // Generate a random interval between 1 and maxScrollInterval seconds
    // This is to avoid frequent scrolling patterns and avoid bot detection
    const scrollInterval = Math.floor(Math.random() * maxScrollInterval) + 1;

    await this._page.evaluate(
      async (step, interval, maxTime) => {
        return new Promise((resolve) => {
          let lastScrollHeight = 0;
          let stillLoading = true;

          const scrollAmount = () => {
            window.scrollBy(0, step);

            if (window.innerHeight + window.scrollY < document.body.offsetHeight || stillLoading) {
              // If still loading or haven't reached the end, keep scrolling
              setTimeout(scrollAmount, interval);
            } else {
              resolve(true);
            }
          };

          // Check for new content periodically. If no new content has been loaded after `maxTime`, stop checking.
          const checkForNewContent = () => {
            const newScrollHeight = document.body.scrollHeight;
            if (lastScrollHeight !== newScrollHeight) {
              stillLoading = true;
              lastScrollHeight = newScrollHeight;
              setTimeout(checkForNewContent, maxTime);
            } else {
              stillLoading = false;
            }
          };

          scrollAmount();
          checkForNewContent();

          // Add an emergency timeout to avoid infinite scrolling
          // This should solve the protocol timeout error
          setTimeout(() => {
            resolve(true);
          }, 15000);
        });
      },
      scrollStep,
      scrollInterval,
      maxWaitTime,
    );
  }

  /**
   * Check if an element is visible
   * @param selector
   * @returns True if the element is visible
   */
  async isElementVisible(selector: string, timeout = 3000) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Timeout exceeded'));
      }, timeout);
    });

    const evaluatePromise = this._page.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (element) {
        const style = window.getComputedStyle(element);
        return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      }
      return false;
    }, selector);

    try {
      const result = await Promise.race([timeoutPromise, evaluatePromise]);
      return result;
    } catch (error) {
      // Handle timeout error or rethrow it
      throw error;
    }
  }

  /**
   * @description Take a screenshot of the current page
   * @param name - The name of the screenshot
   */
  async takeScreenshot(name: string) {
    if (!!+process.env.SAVE_SCREENSHOTS) {
      try {
        await fs.promises.mkdir('screenshots', { recursive: true });
        await this._page?.screenshot({ path: `./screenshots/${name}-${Date.now()}.png` });
      } catch (err) {
        console.log('There was an error taking a screenshot', err);
      }
    }
  }
}
