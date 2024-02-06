import * as appInsights from 'applicationinsights';

export class LogService {
  private readonly _client: appInsights.TelemetryClient;
  private readonly _enabled: boolean = false;

  constructor(runKey?: string) {
    console.log('APPLICATIONINSIGHTS_ENABLED', !!+process.env.APPLICATIONINSIGHTS_ENABLED);
    if (!!+process.env.APPLICATIONINSIGHTS_ENABLED) {
      try {
        if (!process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
          throw new Error('No instrumentation key found, skipping app insights setup');
        }

        appInsights
          .setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
          .setAutoDependencyCorrelation(false)
          .setAutoCollectRequests(false)
          .setAutoCollectPerformance(true, false)
          .setAutoCollectExceptions(true)
          .setAutoCollectDependencies(true)
          .setAutoCollectConsole(false, false)
          .setUseDiskRetryCaching(false)
          .setSendLiveMetrics(true);
        appInsights.start();

        this._enabled = true;

        this._client = appInsights.defaultClient;

        this.setRunKey(runKey || 'scripts-execution');
      } catch (err) {
        console.log('There was an error setting up app insights:', err?.message);
      }
    }
  }

  /**
   * @description Set the run key for the logger as well as the app insights operation name
   */
  setRunKey(key: string) {
    if (this._enabled && !!this._client) {
      this._client.context.tags[appInsights.defaultClient.context.keys.operationName] = key;
    }
  }

  /**
   * @description Log an error to app insights and the console
   * @param err - The error to log
   */
  error(err: Error) {
    if (this._enabled) {
      this._client?.trackException({ exception: err, severity: appInsights.Contracts.SeverityLevel.Error });
    }
    console.error(err);
  }

  /**
   * @description Log a message to app insights and the console
   * @param msg - The message to log
   */
  log(msg: string) {
    if (this._enabled) {
      this._client?.trackTrace({
        message: msg,
        severity: appInsights.Contracts.SeverityLevel.Information,
      });
    }
    console.log(msg);
  }

  /**
   * @description Log a warning to app insights and the console
   * @param msg - The message to log
   */
  logWarning(msg: string) {
    if (this._enabled) {
      this._client?.trackTrace({
        message: msg,
        severity: appInsights.Contracts.SeverityLevel.Warning,
      });
    }
    console.warn(msg);
  }

  /**
   * @description Log a request to app insights
   * @param name - The name of the request
   * @param url - The url of the request
   * @param duration - The duration of the request
   * @param statusCode - The status code of the request
   * @param success - Whether the request was successful
   */
  logRequest(name: string, url: string, duration: number, statusCode: number, success: boolean) {
    if (this._enabled) {
      this._client?.trackRequest({
        name,
        url,
        duration,
        resultCode: statusCode,
        success,
      });
    }
  }

  /**
   * @description Send all pending telemetry
   */
  flush() {
    if (this._enabled) {
      this._client?.flush();
    }
  }
}
