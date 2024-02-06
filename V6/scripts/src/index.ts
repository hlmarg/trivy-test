import { DateTime } from 'luxon';
import { runScraper } from './scrapers';
import { ExecutionStatus, ScriptType } from './shared/enums';
import { validateEnvironmentVariables, validateMainParameters } from './shared/helpers';
import {
  CommandPayload,
  CookiePayload,
  EmailImageAttachment,
  ExecutionResults,
  ScraperPayload,
} from './shared/interfaces';
import { ApiService, EmailService, LogService, StorageService } from './shared/services';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { generateCookies } from './cookies';

dotenv.config();

/**
 * @description Exit the process with the specified code and log the message
 * @param code - The exit code
 * @param logService - The log service
 */
const exitProcess = async (code: number, logService?: LogService) => {
  if (logService) {
    logService.log(`Exiting process with code ${code}`);
    logService.flush();
  }

  // Wait for the logger to flush before exiting, as a promise for 500ms
  await new Promise((resolve) => setTimeout(resolve, 500));
  process.exit(code);
};

/**
 * @description The main process
 */
const mainProcess = async () => {
  try {
    validateEnvironmentVariables();
  } catch (err) {
    console.log('Error validating environment variables');
    console.log(err);
    await exitProcess(1);
  }

  // Initialize the logger
  let _logger: LogService;
  try {
    _logger = new LogService();
  } catch (err) {
    console.log('Error initializing logger');
    console.log(err);
    await exitProcess(1);
  }

  // Initialize the storage account service
  let _storageAccountService: StorageService;
  try {
    _storageAccountService = new StorageService(_logger);
  } catch (err) {
    _logger.log(`Error initializing storage account service`);
    _logger.error(err);
    await exitProcess(1, _logger);
  }

  // Initialize API service
  let _apiService: ApiService;
  try {
    _apiService = new ApiService();
  } catch (err) {
    _logger.log(`Error initializing API service`);
    _logger.error(err);
    await exitProcess(1, _logger);
  }

  // Initialize the email service
  let _emailService: EmailService;
  try {
    _emailService = new EmailService(_logger);
  } catch (err) {
    _logger.log(`Error initializing email service`);
    _logger.error(err);
    await exitProcess(1, _logger);
  }

  // Get run parameters from blob
  let _runParameters: CommandPayload | undefined;
  try {
    _runParameters = (await _storageAccountService.fetchParametersFromBlob(
      process.env.RUN_PARAMETERS_BLOB_NAME,
    )) as CommandPayload;
  } catch (err) {
    _logger.log(`Error fetching run parameters from blob`);
    _logger.error(err);
    await exitProcess(1, _logger);
  }

  // Validate parameters
  try {
    validateMainParameters(_runParameters);
  } catch (err) {
    _logger.log(`Error validating parameters`);
    _logger.error(err);
    await exitProcess(1, _logger);
  }

  let _executionResults: ExecutionResults[] = [];

  switch (_runParameters.type) {
    case ScriptType.Scraper:
      {
        _executionResults = await runScraper(_runParameters as ScraperPayload, _logger, _storageAccountService);
      }
      break;

    case ScriptType.CookiesGeneration:
      {
        _executionResults = await generateCookies(_runParameters as CookiePayload, _logger, _storageAccountService);
      }
      break;
    case ScriptType.Valuation:
      {
        // TODO: Implement valuation script
      }
      break;
    default: {
      _logger.log(`Type: ${_runParameters.type} - Not implemented`);
      await exitProcess(1, _logger);
    }
  }

  const screenshots: string[] = [];
  const attachments: EmailImageAttachment[] = [];

  // Upload screenshots to blob
  try {
    if (!!+process.env.SAVE_SCREENSHOTS) {
      _logger.log(`Uploading screenshots to blob`);

      // Read screenshots under the screenshots folder
      try {
        fs.readdirSync('screenshots').forEach(async (file) => {
          screenshots.push(`screenshots/${file}`);
          const fileContent = fs.readFileSync(`screenshots/${file}`).toString('base64');
          attachments.push({
            filename: file,
            content: fileContent,
            type: 'image/png',
            disposition: 'attachment',
          });
        });
      } catch (err) {
        _logger.log(`Error reading screenshots folder`);
        _logger.error(err);
      }

      if (screenshots.length > 0) {
        await _storageAccountService.uploadScreenshotsToBlob(screenshots);

        _logger.log(`Screenshots uploaded successfully to blob`);

        // Delete screenshots
        for (const screenshot of screenshots) {
          await fs.promises.unlink(screenshot);
        }
      } else {
        _logger.log(`No screenshots to upload`);
      }
    }
  } catch (err) {
    _logger.log(`Error uploading screenshots to blob`);
    _logger.error(err);
  }

  // Send email
  try {
    if (!!+process.env.SEND_EMAIL) {
      const errors = _executionResults.filter((x) => x.executionStatus === ExecutionStatus.Error);
      if (errors.length > 0) {
        _logger.log(`Sending email with ${errors.length} errors`);
        await _emailService.reportError(_runParameters, _executionResults, screenshots, attachments);
      }
    }
  } catch (err) {
    _logger.log(`Error sending email`);
    _logger.error(err);
  }

  // Save the results to a file
  if (!!+process.env.API_SAVE_LOCAL_RESULTS) {
    try {
      await fs.promises.mkdir('executions', { recursive: true });
      const millis = DateTime.now().toMillis();

      await fs.promises.writeFile(
        `executions/api-payload-${_runParameters.id}-${millis}.json`.toLowerCase(),
        JSON.stringify(
          {
            executionId: _runParameters.id,
            results: _executionResults,
          },
          null,
          2,
        ),
      );
    } catch (e) {}
  }

  // Send execution results to API
  try {
    const authenticated = await _apiService.authenticate();
    _logger.log(`Authenticated with API: ${authenticated}`);

    if (!authenticated) {
      throw new Error('Error authenticating with API');
    }

    _logger.log('Sending results to API');
    await _apiService.sendResults({
      executionId: _runParameters.id,
      results: _executionResults,
    });

    _logger.log('Results sent to API successfully');
  } catch (err) {
    _logger.log(`Error sending results to API`);
    _logger.error(err);
    await exitProcess(1, _logger);
  }

  await exitProcess(0, _logger);
};

mainProcess();
