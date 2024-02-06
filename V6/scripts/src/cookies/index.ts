import { DateTime } from 'luxon';
import { CookiesType, ExecutionStatus } from '../shared/enums';
import { validateCookiesParameters } from '../shared/helpers';
import { CookiePayload, CookieGenerationResults } from '../shared/interfaces';
import { LogService, StorageService } from '../shared/services';

export const generateCookies = async (
  _cookiePayload: CookiePayload,
  _logger: LogService,
  _storageAccountService: StorageService,
) => {
  _logger.log(`Running cookie generation ${_cookiePayload.platform}`);

  _logger.setRunKey(`generate-${_cookiePayload.platform}-cookies`);

  let executionResult: CookieGenerationResults = {
    success: true,
    executionStatus: ExecutionStatus.Success,
    executionMessage: '',
    results: [],
  };

  let link = '';

  try {
    try {
      validateCookiesParameters(_cookiePayload);
    } catch (err) {
      _logger.log(`Error validating cookie parameters`);
      throw err;
    }

    // Execute correct cookie generator
    switch (_cookiePayload.platform) {
      case CookiesType.Facebook:
        {
          const { generateFacebookCookies } = await import('./facebook');
          executionResult = await generateFacebookCookies(_logger, _cookiePayload.accounts);
        }
        break;
    }

    // Save results to storage account
    if (executionResult && executionResult.success && executionResult.results.length > 0) {
      // This ensures unique names for the results file
      const millis = DateTime.now().toMillis();

      // Upload results to blob storage
      const resultsLink = `cookies-${_cookiePayload.platform}-${millis}.json`;
      const uploadResult = await _storageAccountService.storeObjectInBlob(executionResult.results, resultsLink);

      if (!uploadResult || uploadResult.errorCode) {
        executionResult.success = false;
        executionResult.executionStatus = ExecutionStatus.Error;
        executionResult.executionMessage = `${executionResult.executionMessage}\r\n${uploadResult.errorCode}`;
      } else {
        link = resultsLink;
      }
    }
  } catch (error) {
    executionResult.success = false;
    executionResult.executionStatus = ExecutionStatus.Error;
    executionResult.executionMessage = error.message;

    _logger.log(`Error generating cookies`);
    _logger.error(error);
  }

  return [
    {
      executionId: _cookiePayload.id,
      marketId: 0,
      script: `${_cookiePayload.type}-${_cookiePayload.platform}`,
      success: executionResult.success,
      startedAt: DateTime.now().toISO(),
      endedAt: DateTime.now().toISO(),
      executionStatus: executionResult.executionStatus,
      executionMessage: executionResult.executionMessage,
      totalVehicles: 0,
      skippedVehicles: 0,
      validVehicles: 0,
      resultsLink: link,
    },
  ];
};
