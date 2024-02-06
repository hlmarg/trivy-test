import { SCRAPER_DEFAULT_SETTINGS } from '../default-settings';
import { MarketSettingsTypes } from '../enums';
import { Market } from '../interfaces';
import { MarketParams } from '../interfaces/markets';

/**
 * @description
 * This function take an string and remove all utf8 escaped characters from it
 */
export const removeUtf8EscapedCharacters = (str: string): string =>
  str
    ?.replace(/\\u[\dA-Fa-f]{4}/g, ' ')
    ?.replace(/\n/g, '\n')
    ?.replace(/\\n/g, '\n')
    ?.replace(/\//g, ' ')
    ?.replace(/\/\//g, ' ')
    ?.replace(/\\/g, ' ')
    ?.replace(/&amp;/g, ' ')
    ?.trim();

/**
 * @description
 * This function take an string and remove years since 1900 until current year from it
 */
export const removeYears = (str: string) => {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1900 + 2 }, (_, i) => i + 1900);
  const regex = new RegExp(years.join('|'), 'g');
  return str.replace(regex, '')?.trim();
};

/**
 * @description
 * This function take the nearest radius value from the provided radius and stop it when it finds a match
 */

export const takeTheNearestRadiusValue = (goal: number, radiuses: number[]) =>
  (radiuses || []).reduce(function (prev, curr) {
    return Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev;
  });

/**
 * @description
 * This function sleeps for the provided milliseconds
 * @param ms milliseconds to sleep
 */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @description
 * This function sleeps for a random amount of time between 2 and 8 seconds
 * @param max milliseconds to sleep
 * @param min milliseconds to sleep
 */
export const randomSleep = (max = 8000, min = 2000) => {
  return new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));
};

/**
 * @description Gets the market settings value matching the provided key
 * @param key The key to get the value for
 * @param settings The settings to search
 */
export const getMarketSettings = (key: MarketSettingsTypes, settings: { name: MarketSettingsTypes; value: string }[]) =>
  settings.find((setting) => setting.name === key)?.value;

// Default values for the scraper
export const DEFAULTS = {
  days: 15,
  results: 100,
};

/**
 * @description Get the defaults parameters for markets
 * @param _market - The market to get the parameters for
 * @returns The parameters
 */
export const getParams = (_market: Market): MarketParams => {
  return {
    minPrice: SCRAPER_DEFAULT_SETTINGS.MIN_PRICE,
    maxPrice:
      +getMarketSettings(MarketSettingsTypes.SearchMaxPrice, _market.marketSettings) ||
      SCRAPER_DEFAULT_SETTINGS.MAX_PRICE,
    maxMileage:
      +getMarketSettings(MarketSettingsTypes.SearchMaxMileage, _market.marketSettings) ||
      SCRAPER_DEFAULT_SETTINGS.MAX_MILES,
    maxYear:
      +getMarketSettings(MarketSettingsTypes.SearchMaxYear, _market.marketSettings) ||
      SCRAPER_DEFAULT_SETTINGS.MAX_YEAR,
    minYear:
      +getMarketSettings(MarketSettingsTypes.SearchMinYear, _market.marketSettings) ||
      SCRAPER_DEFAULT_SETTINGS.MIN_YEAR,
    searchRadius:
      +getMarketSettings(MarketSettingsTypes.SearchRadius, _market.marketSettings) || SCRAPER_DEFAULT_SETTINGS.RADIUS,
    daysSinceListed: process.env.SCRAPPER_DAYS_TO_SCRAPE || SCRAPER_DEFAULT_SETTINGS.MAX_DAYS,
  };
};
