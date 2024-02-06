import { MarketSettingsTypes, MarketVehiclesType } from '../../shared/enums';
import { Market, MarketParams } from '../../shared/interfaces';
import { CaptchaStatus, checkCaptchaStatus, getMarketUrl, refreshCaptcha, solveCaptcha } from './craigslist-helper';
import { LogService, ScraperService } from '../../shared/services';
import axios from 'axios';
import mockAdapter from 'axios-mock-adapter';
import Sinon from 'sinon';
const mock = new mockAdapter(axios);

describe('Craigslist Helper', () => {
  beforeAll(async () => {
    jest.mock('puppeteer', () => ({
      launch: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
          goto: jest.fn().mockResolvedValue(null),
          waitForSelector: jest.fn().mockResolvedValue(null),
          click: jest.fn().mockResolvedValue(null),
          $: jest.fn().mockResolvedValue(null),
          reload: jest.fn().mockResolvedValue(null),
        }),
        close: jest.fn().mockResolvedValue(null),
      }),
    }));
  });

  afterAll(async () => {
    jest.resetAllMocks();
  });

  it('should return a valid URL with the correct query parameters', () => {
    const market: Market = {
      id: 1,
      marketSettings: [
        {
          name: MarketSettingsTypes.CraigslistLocation,
          value: 'denver',
        },
      ],
      vehiclesType: MarketVehiclesType.RV,
      zipCode: '12345',
      executionId: 1,
      location: 'Chico, CA',
      dealershipGroupId: 1,
      blockedUsers: [],
      dealershipGroup: {
        name: 'Test',
      },
    };

    const params: MarketParams = {
      minPrice: 1000,
      maxPrice: 5000,
      maxMileage: 100000,
      maxYear: 2022,
      minYear: 2010,
      searchRadius: 10,
      daysSinceListed: 7,
    };

    const expectedUrl =
      'https://denver.craigslist.org/search/rva?min_price=1000&max_price=5000&max_auto_miles=100000&max_auto_year=2022&min_auto_year=2010&search_distance=10&daysSinceListed=7&postal=12345&sortBy=date&srchType=T&searchNearby=1&purveyor=owner&bundleDuplicates=1&auto_title_status=1&auto_title_status=5';

    const result = getMarketUrl(market, params);

    expect(result).toBe(expectedUrl);
  });

  it('should correctly detect when a captcha is enabled and solved', async () => {
    const scraperMock = new ScraperService();
    await scraperMock.initScraper('https://example.com');

    scraperMock.currentPage.on = Sinon.stub().resolves(null);

    const captchaIsEnabledCallback = jest.fn();
    const captchaIsSolvedCallback = jest.fn();

    await checkCaptchaStatus(scraperMock.currentPage, captchaIsEnabledCallback, captchaIsSolvedCallback);

    Sinon.assert.calledOnce(scraperMock.currentPage.on);

    await scraperMock.closeScraper();
  });

  it('should correctly set and reset the properties of CaptchaStatus', () => {
    const captchaStatus = new CaptchaStatus();

    expect(captchaStatus.captchaIsEnabled).toBe(false);
    expect(captchaStatus.captchaIsSolved).toBe(false);

    captchaStatus.setCaptchaAsEnabled();
    expect(captchaStatus.captchaIsEnabled).toBe(true);

    captchaStatus.setCaptchaAsSolver();
    expect(captchaStatus.captchaIsSolved).toBe(true);

    captchaStatus.reset();
    expect(captchaStatus.captchaIsEnabled).toBe(false);
    expect(captchaStatus.captchaIsSolved).toBe(false);
  });

  it('should correctly solve a captcha using an external API', async () => {
    // Mock waitForSelector
    const waitForSelectorMock = jest.spyOn(ScraperService.prototype, 'waitForSelector');
    waitForSelectorMock.mockImplementation(() => Promise.resolve());

    // Mock click
    const clickMock = jest.spyOn(ScraperService.prototype, 'click');
    clickMock.mockImplementation(() => Promise.resolve());

    // Mock log
    const logMock = jest.spyOn(LogService.prototype, 'log');
    logMock.mockImplementation(() => {
      return;
    });

    const scraper = new ScraperService();
    const url = 'https://example.com';
    await scraper.initScraper(url);
    const captchaStatus = new CaptchaStatus();
    const logger = new LogService();

    mock.onPost('https://api.capsolver.com/createTask').reply(200, { taskId: '123', solutions: [true, false] });
    mock.onGet('image1').reply(200, 'image1');
    mock.onGet('image2').reply(200, 'image2');

    scraper.waitForSelector = Sinon.stub().resolves(null);
    scraper.click = Sinon.stub().resolves(null);

    scraper.currentPage.$ = Sinon.stub().resolves({
      click: jest.fn(),
      contentFrame: jest.fn().mockReturnValue({
        $: jest.fn().mockReturnValue({
          evaluate: jest.fn().mockReturnValue('question'),
        }),
        $$: jest.fn().mockReturnValue([
          {
            click: jest.fn(),
            evaluate: jest.fn().mockReturnValue('url("image1")'),
            getAttribute: jest.fn().mockReturnValue('url("image1")'),
          },
          {
            click: jest.fn(),
            evaluate: jest.fn().mockReturnValue('url("image2")'),
            getAttribute: jest.fn().mockReturnValue('url("image2")'),
          },
        ]),
        click: jest.fn(),
      }),
    });

    jest.mock('./craigslist-helper', () => ({
      getCaptchaQuestionData: jest.fn().mockReturnValue({
        question: 'question',
        queries: ['image1', 'image2'],
      }),
    }));

    captchaStatus.setCaptchaAsEnabled();

    await solveCaptcha(scraper, url, captchaStatus, logger);

    Sinon.assert.calledOnce(scraper.currentPage.$);
    Sinon.assert.calledWith(scraper.waitForSelector, '.reply-button');
    Sinon.assert.calledWith(scraper.click, '.reply-button');

    await scraper.closeScraper();
  });

  it('should refresh the captcha when called', async () => {
    // Mock scraper and logger
    process.env.APPLICATIONINSIGHTS_ENABLED = '0';

    const loggerMock = new LogService();
    const scraperMock = new ScraperService();

    await scraperMock.initScraper('https://example.com');

    scraperMock.currentPage.$ = Sinon.stub().resolves(null);
    scraperMock.currentPage.reload = Sinon.stub().resolves(null);

    loggerMock.error = Sinon.stub().resolves(null);
    loggerMock.log = Sinon.stub().resolves(null);

    await refreshCaptcha(scraperMock, loggerMock);

    // Verify that the correct functions were called

    Sinon.assert.calledOnce(scraperMock.currentPage.$);
    Sinon.assert.notCalled(loggerMock.error);

    await scraperMock.closeScraper();
  });
});
