import { ExecutionStatus, ScraperType } from '../shared/enums';
import { validateScraperMarketParameters, validateScraperParameters, createErrorResult } from '../shared/helpers';
import { ExecutionResults, ScraperPayload, ScraperResults } from '../shared/interfaces';
import { LogService, ScraperService, StorageService } from '../shared/services';
import { DateTime } from 'luxon';

export const runScraper = async (
  _scraperPayload: ScraperPayload,
  _logger: LogService,
  _storageAccountService: StorageService,
) => {
  _logger.log(`Running scraper ${_scraperPayload.scraper}`);

  try {
    validateScraperParameters(_scraperPayload);
  } catch (error) {
    _logger.log(`Error validating scraper parameters`);
    _logger.error(error);
    return;
  }

  const { markets, id, type, scraper } = _scraperPayload;

  const key = `scraper-${_scraperPayload.scraper}-${_scraperPayload.id}`;
  _logger.setRunKey(key);
  _logger.log(`Initializing scraper ${_scraperPayload.scraper} for ${_scraperPayload.markets.length} markets`);

  const executionResults: ExecutionResults[] = [];
  const _scraperService = new ScraperService();

  let skipRemainingMarkets = false;

  for (const market of markets) {
    const executionDate = DateTime.utc().toISO();

    _logger.log(`Running scraper for market ${market.id} - ${executionDate}`);

    try {
      if (skipRemainingMarkets) {
        executionResults.push(
          createErrorResult(
            market.id,
            market.executionId || id,
            `${type}-${scraper}`,
            executionDate,
            new Error(`Error in ${scraper}, skipping remaining markets.`),
          ),
        );

        _logger.log('Skipping current market');
        continue;
      }

      // Validate market parameters
      validateScraperMarketParameters(market);

      // Execute correct scraper
      let result: ScraperResults;

      switch (_scraperPayload.scraper) {
        case ScraperType.Facebook:
          {
            const { executeScraper } = await import('./facebook');
            result = await executeScraper(market, _logger, _scraperService);

            // Break if there was an error logging into any account
            if (!result.success && result?.executionMessage.includes('There was an error logging into')) {
              _logger.log('Error logging into facebook, skipping remaining markets');
              skipRemainingMarkets = true;
            }
          }
          break;
        case ScraperType.Craigslist:
          {
            const { executeScraper } = await import('./craigslist');
            result = await executeScraper(market, _logger, _scraperService);
          }
          break;
        case ScraperType.CarsCom:
          {
            const { executeScraper } = await import('./cars.com');
            result = await executeScraper(market, _logger);
          }
          break;
        case ScraperType.Autotrader:
          {
            const { executeScraper } = await import('./autotrader');
            result = await executeScraper(market, _logger);
          }
          break;
        case ScraperType.Cargurus:
          {
            const { executeScraper } = await import('./cargurus');
            result = await executeScraper(market, _logger);
          }
          break;
        case ScraperType.Ksl:
          {
            const { executeScraper } = await import('./ksl');
            result = await executeScraper(market, _logger);
          }
          break;
        default: {
          throw new Error(`Scraper ${_scraperPayload.scraper} not implemented yet!`);
        }
      }

      const executionResult: ExecutionResults = {
        executionId: market.executionId || id,
        marketId: market.id,
        script: `${type}-${scraper}`,
        success: result.success,
        startedAt: executionDate,
        endedAt: DateTime.utc().toISO(),
        executionStatus: result.success ? ExecutionStatus.Success : ExecutionStatus.Error,
        executionMessage: result.executionMessage,
        totalVehicles: result.totalVehicles,
        skippedVehicles: result.skippedVehicles,
        validVehicles: result.validVehicles,
        resultsLink: '',
      };

      // Save results to storage account
      if (result.success && result.results.length > 0) {
        // This ensures unique names for the results file
        const millis = DateTime.now().toMillis();

        // Upload results to blob storage
        const resultsLink = `results-${type}-${scraper}-${market.executionId || id}-market-${market.id}-${millis}.json`;
        const uploadResult = await _storageAccountService.storeObjectInBlob(result.results, resultsLink);

        if (!uploadResult || uploadResult.errorCode) {
          executionResult.success = false;
          executionResult.executionStatus = ExecutionStatus.Error;
          executionResult.executionMessage = `${executionResult.executionMessage}\r\n${uploadResult.errorCode}`;
        } else {
          executionResult.resultsLink = resultsLink;
        }
      }

      // Add execution results to array
      executionResults.push(executionResult);

      _logger.log(`Finished running ${_scraperPayload.scraper} scraper for market ${market.id}`);
    } catch (error) {
      _logger.log(`Error running scraper for market ${market.id}`);
      _logger.error(error);
      executionResults.push(createErrorResult(market.id, id, `${type}-${scraper}`, executionDate, error));
    }
  }

  return executionResults;
};
