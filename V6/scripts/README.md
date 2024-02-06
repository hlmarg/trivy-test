# Description

The code on `V6/scripts/src/index.ts` represents the core logic of a Node.js application. It performs the following tasks:

1. Validates environment variables and exits on failure.

2. Initializes a logger service and exits on failure.

3. Initializes a storage account service, using the logger for error handling.

4. Fetches run parameters from a blob storage, logging errors if they occur.

5. Validates the retrieved parameters and exits on failure.

6. Executes scripts based on the provided type.

7. Saves or sends execution results to a blob storage or an API service.

8. Exits the process with status 0 on success, or status 1 on error, providing the logger for error information.

# Application Scripts

This section provides an overview of the scripts available in the application's package.json file for managing development, building, formatting, and linting tasks.

## Start Application

To start the application in production mode, use the following script:

```bash
npm start
```

This script will build the application using the `build` script and then run the built application using `node dist/index.js`.

### Start Application in Development Mode

For development purposes, you can start the application with auto-reloading using the following script:

```bash
npm run start:dev
```

This script utilizes `nodemon` to automatically restart the application whenever changes are detected, making it convenient for development and debugging.

## Build Application

To build the application, use the following script:

```bash
npm run build
```

This script performs the following tasks:

- Removes the existing `./dist` directory using `rimraf`.
- Transpiles TypeScript code to JavaScript using `tsc`, resulting in the compiled code being placed in the `./dist` directory.

## Format Code

To automatically format the source code using Prettier, run the following script:

```bash
npm run format
```

This script uses Prettier to format all TypeScript files located in the `src` directory and its subdirectories.

## Lint Code

To perform static code analysis and automatically fix linting issues in the application code, use the following script:

```bash
npm run lint
```

This script uses ESLint to check and fix TypeScript files in the `src`, `apps`, `libs`, and `test` directories and their subdirectories.

Feel free to utilize these scripts to streamline your development workflow, ensure code quality, and start and build your application with ease.

# Application Configuration

This readme provides an overview of the configuration settings for an application that utilizes various services and functionalities. Ensure that you have the necessary access and permissions for the services mentioned in the configuration.

To configure the application, you can use environment variables. A sample `.env.example` file has been provided as a starting point. You can copy this file and customize it with your specific values.

```bash
cp .env.example .env
```

## Azure Blob Storage Settings

The application utilizes Azure Blob Storage to store and manage data. Make sure to fill in the appropriate values for the following environment variables:

- `AZURE_STORAGE_CONNECTION_STRING_SCRAPER`: This should contain the connection string for Azure Blob Storage, including information about the account name, account key, and endpoint suffix.
- `AZURE_STORAGE_SCRAPER_CONTAINER`: Specify the name of the Azure Blob Storage container where the application will store its data.

## API Integration Settings

The application integrates with an external API. You need to provide the following information:

- `API_INTEGRATION_URL`: Enter the URL of the API that the application will connect to.
- `API_INTEGRATION_USERNAME`: Provide the username required for authentication with the API.
- `API_INTEGRATION_PASSWORD`: Enter the password associated with the provided username for - API authentication.
- `API_SAVE_LOCAL_RESULTS`: Set to 0 for false or 1 for true to save the api results to a file: `executions/api-payload-executionId-timestamp.json`

## Application Insights Settings

Application Insights is used for monitoring and diagnostics. Configure the following setting:

- `APPLICATIONINSIGHTS_CONNECTION_STRING`: Insert the connection string with the instrumentation key and ingestion endpoint for your Application Insights instance.
- `APPLICATIONINSIGHTS_ENABLED`: Set to 0 for false or 1 for true to enable.

## Parameter Blob Settings

This section relates to a specific Blob within Azure Blob Storage:

- `RUN_PARAMETERS_BLOB_NAME`: Specify the name of the Blob that contains the application's parameters.

## Puppeteer Settings

Puppeteer is a headless browser that the application uses for web scraping tasks. Configure the following settings:

- `DEBUG_PUPPETEER`: Set to 0 for false or 1 for true to enable/disable Puppeteer debugging.
- `PUPPETEER_TIMEOUT`: Set the Puppeteer timeout value in milliseconds.

## Notifications Settings

We use sendgrid to send notifications to keep the process running.

- `SEND_GRID_FROM`: Defines the email where the notifications are being sent from.
- `SEND_GRID_TO`: Defines the email where the notifications are being sent to.
- `SEND_GRID_KEY`: Sendgrid API key to send emails

## Scraper Settings

### General

These settings apply specifically to the all web scraping functionality of the application:

- `SCRAPPER_DAYS_TO_SCRAPE`: The amount of days to scrape. Default 7
- `SCRAPPER_MAX_RESULTS`: The amount of results to scrape. Default 50
- `SEND_EMAIL`: Set to 0 for false or 1 for true to send email reports. Default 0.
- `SAVE_SCREENSHOTS`: Set to 0 for false or 1 for true to save the scrape results to a file: `screenshots/name-timestamp.png`. Default 0.

### Facebook

These settings apply specifically to the Facebook web scraping functionality of the application:

- `FACEBOOK_USERNAME`: Enter your Facebook username for scraping.
- `FACEBOOK_PASSWORD`: Provide your Facebook password.
- `FACEBOOK_TWO_FACTOR`: Defines two factor authentication secret to be used in the authentication flow.
- `FACEBOOK_COOKIE`: Enter the generated facebook cookie to skip the authentication screen. If set the scraper won't use username/password.
- `FACEBOOK_SCROLL_TO_BOTTOM`: Set to 0 for false or 1 for true to enable scrolling to the bottom of Facebook pages during scraping.
- `FACEBOOK_SAVE_PRODUCT_HTML`: Set to 0 for false or 1 for true to enable saving product HTML during scraping.
- `FACEBOOK_MAX_RESULTS`: Set the maximum number of results to retrieve from Facebook.
- `FACEBOOK_SAVE_RESULTS`: Set to 0 for false or 1 for true to save the scrape results to a file: `executions/results-dealership-location-timestamp.json`
- `FACEBOOK_SAVE_COOKIES`: Set to 0 for false or 1 for true to save the scrape results to a file: `cookies/facebook-timestamp.json`

### Craigslist

These settings apply specifically to the Craigslist web scraping functionality of the application:

- `CRAIGSLIST_SAVE_RESULTS`: Set to 0 for false or 1 for true to save the scrape results to a file: `executions/cl-results-dealership-location-timestamp.json`

### Cars.com

These settings apply specifically to the Cars.com web scraping functionality of the application:

- `CARS_COM_SAVE_RESULTS`: Set to 0 for false or 1 for true to save the scrape results to a file: `executions/cars-dot-com-results-dealership-location-timestamp.json`

### Autotrader

These settings apply specifically to the Autotrader web scraping functionality of the application:

- `AUTOTRADER_SAVE_RESULTS`: Set to 0 for false or 1 for true to save the scrape results to a file: `executions/autotrader-results-dealership-location-timestamp.json`

## Cookie Script Settings

### Facebook

These settings apply specifically to the Facebook cookie generation functionality of the application:

- `FACEBOOK_SAVE_COOKIES`: Set to 0 for false or 1 for true to save the scrape results to a file: `cookies/facebook-timestamp.json`

Please ensure that you fill in these configuration settings with accurate and secure values. Keep sensitive information such as passwords and access keys confidential.

Review and update these settings as needed to ensure the proper operation of your application.
