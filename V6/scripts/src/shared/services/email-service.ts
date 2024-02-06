import { CommandPayload, EmailImageAttachment, ExecutionResults } from '../interfaces';
import { LogService } from './log-service';
import sendGrid from '@sendgrid/mail';

export class EmailService {
  private readonly _fromAddress = process.env.SEND_GRID_FROM;
  private readonly _toAddress = process.env.SEND_GRID_TO;

  constructor(private _logger: LogService) {
    const apiKey = process.env.SEND_GRID_KEY;

    if (!apiKey) {
      this._logger.error(new Error(`Missing Sendgrid Configuration SEND_GRID_KEY: ${apiKey}`));
    }

    sendGrid.setApiKey(apiKey);

    if (!this._fromAddress) {
      this._logger.error(new Error(`Missing Sendgrid Configuration SEND_GRID_FROM: ${this._fromAddress}`));
    }

    if (!this._toAddress) {
      this._logger.error(new Error(`Missing Sendgrid Configuration SEND_GRID_TO: ${this._toAddress}`));
    }
  }

  sendEmail(subject: string, body: string): Promise<any> {
    return sendGrid.send({
      to: this._toAddress,
      from: this._fromAddress,
      subject,
      html: body,
    });
  }

  reportError(
    payload: CommandPayload,
    errors: ExecutionResults[],
    screenshots: string[],
    attachments: EmailImageAttachment[],
  ) {
    const payloadJson = JSON.stringify(payload, null, 2);
    const errorsJson = JSON.stringify(errors, null, 2);
    const screenshotsJson = JSON.stringify(screenshots, null, 2);

    const emailBody = `<html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f4f4f4;
        }
  
        h2 {
          background-color: #007BFF;
          color: #fff;
          padding: 10px;
          text-align: center;
          font-size: 18px;
        }
  
        strong {
          color: #007BFF
        }
  
        pre {
          background-color: #fff;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 5px;
          overflow-x: auto;
          font-size: 14px; /* Adjusted text size to be smaller */
        }
      </style>
    </head>
    <body>
      <h2>Script ${payload.type} finished with errors on ${process.env.AZURE_STORAGE_SCRAPER_CONTAINER}</h2>
      <p><strong>Payload Name:</strong></p>
      <pre>${process.env.RUN_PARAMETERS_BLOB_NAME}</pre>
      <p><strong>Results:</strong></p>
      <pre>${errorsJson}</pre>
      <p><strong>Payload:</strong></p>
      <pre>${payloadJson}</pre>
      <p><strong>Screenshots:</strong></p>
      <pre>${screenshotsJson}</pre>
    </body>
  </html>`;

    return sendGrid.send({
      to: this._toAddress,
      from: this._fromAddress,
      subject: `Script ${payload.type}-${process.env.AZURE_STORAGE_SCRAPER_CONTAINER} finished with errors`,
      html: emailBody,
      attachments,
    });
  }
}
