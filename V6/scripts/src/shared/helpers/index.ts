export * from './helpers';
export * from './ignore-terms';
export * from './2fa';

import { DateTime } from 'luxon';
import { ExecutionStatus, VALID_COOKIES_TYPES, VALID_SCRAPER_TYPES, VALID_SCRIPT_TYPES } from '../enums';
import { CommandPayload, CookiePayload, Market, ScraperPayload } from '../interfaces';

/**
 * @description validates the environment variables
 */
export const validateEnvironmentVariables = () => {
  // Set the connection string for app insights
  if (!process.env.APPLICATIONINSIGHTS_CONNECTION_STRING && !!+process.env.APPLICATIONINSIGHTS_ENABLED) {
    throw new Error('No instrumentation key found, skipping app insights setup');
  }

  // Validates storage account variables
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING_SCRAPER) {
    throw Error('Azure Storage Connection string not found');
  }

  if (!process.env.AZURE_STORAGE_SCRAPER_CONTAINER) {
    throw Error('Azure Storage Container not found');
  }

  if (!process.env.RUN_PARAMETERS_BLOB_NAME) {
    throw Error('Run parameters blob name not found');
  }

  // Validates integration variables
  if (!process.env.API_INTEGRATION_URL) {
    throw Error('API integration URL not found');
  }

  if (!process.env.API_INTEGRATION_USERNAME) {
    throw Error('API integration username not found');
  }

  if (!process.env.API_INTEGRATION_PASSWORD) {
    throw Error('API integration password not found');
  }
};

/**
 * @description validates the main parameters
 * @param parameters - The parameters to validate as CommandPayload
 */
export const validateMainParameters = (parameters: CommandPayload) => {
  if (!parameters) {
    throw Error('No parameters found');
  }

  if (!parameters.type || VALID_SCRIPT_TYPES.indexOf(parameters.type) === -1) {
    throw Error('No valid type found');
  }
};

/**
 * @description validates the scraper parameters
 * @param parameters - The parameters to validate as ScraperPayload
 */
export const validateScraperParameters = (parameters: ScraperPayload) => {
  if (!parameters.scraper || VALID_SCRAPER_TYPES.indexOf(parameters.scraper) === -1) {
    throw Error('No valid scraper found');
  }

  if (!parameters.id && parameters.id !== 0) {
    throw Error('No valid id found');
  }

  if (!parameters.markets || !parameters.markets.length) {
    throw Error('No valid markets found');
  }
};

/**
 * @description validates the scraper market parameters
 * @param market - The market to validate
 */
export const validateScraperMarketParameters = (market: Market) => {
  if (!market) {
    throw Error('No valid markets found');
  }

  if (!market.id) {
    throw Error('No valid market id found');
  }

  if (!market.location) {
    throw Error('No valid market name found');
  }

  if (!market.zipCode) {
    throw Error('No valid market zip code found');
  }

  if (!market.marketSettings || !market.marketSettings.length) {
    throw Error('No valid market settings found');
  }
};

/**
 * @description Creates an error result
 * @param marketId - The market id
 * @param executionId - The execution id
 * @param script - The script name
 * @param executionDate - The execution date
 * @param error - The error
 * @returns The error result
 */
export const createErrorResult = (
  marketId: number,
  executionId: number,
  script: string,
  executionDate: string,
  error: Error,
) => ({
  executionId: executionId,
  marketId,
  script: script,
  success: false,
  startedAt: executionDate,
  endedAt: DateTime.utc().toISO(),
  executionStatus: ExecutionStatus.Error,
  executionMessage: error.message,
  totalVehicles: 0,
  skippedVehicles: 0,
  validVehicles: 0,
  resultsLink: '',
});

/**
 * @description Creates a success result
 * @param parameters - The parameters
 */
export const validateCookiesParameters = (parameters: CookiePayload) => {
  if (!parameters.platform || VALID_COOKIES_TYPES.indexOf(parameters.platform) === -1) {
    throw Error('No valid cookie type found');
  }

  if (!parameters.id && parameters.id !== 0) {
    throw Error('No valid id found');
  }
};
