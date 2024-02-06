import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { LogService } from './log-service';

export class StorageService {
  private readonly _connectionString: string;
  private readonly _containerName: string;
  private readonly _blobServiceClient: BlobServiceClient;

  private _checkedContainers: string[] = [];

  constructor(private _logger: LogService) {
    // Check if connection string is defined
    if (!process.env.AZURE_STORAGE_CONNECTION_STRING_SCRAPER) {
      throw Error('Azure Storage Connection string not found');
    }

    // Validates the container variable
    if (!process.env.AZURE_STORAGE_SCRAPER_CONTAINER) {
      throw Error('Azure Storage Container not found');
    }

    // Set the connection string and container name
    this._connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING_SCRAPER;
    this._containerName = process.env.AZURE_STORAGE_SCRAPER_CONTAINER;

    // Create the BlobServiceClient object with connection string
    this._blobServiceClient = BlobServiceClient.fromConnectionString(this._connectionString);
  }

  /**
   * @description Gets parameters from blob storage
   *
   * @param blobName - The name of the blob to fetch
   *
   * @returns The parameters from the blob storage or undefined if the blob doesn't exist
   */
  async fetchParametersFromBlob(blobName: string): Promise<unknown> {
    try {
      const containerClient: ContainerClient = await this._getContainer(this._containerName);
      const blobClient = containerClient.getBlobClient(blobName);

      const downloadBlockBlobResponse = await blobClient.download(0);
      const blobData = (await this._streamToBuffer(downloadBlockBlobResponse.readableStreamBody)).toString();

      return JSON.parse(blobData);
    } catch (error) {
      this._logger.log(`Error fetching parameters from blob`);
      this._logger.error(error);
    }

    return undefined;
  }

  /**
   * @description Get container client and create it if it doesn't exist
   *
   * @param containerName
   */
  async _getContainer(containerName: string): Promise<ContainerClient> {
    try {
      if (!this._checkedContainers.includes(containerName)) {
        // Check if container exists
        const containerExists = await this._blobServiceClient.getContainerClient(containerName).exists();
        if (containerExists) {
          return this._blobServiceClient.getContainerClient(containerName);
        }

        this._checkedContainers.push(containerName);

        // Container doesn't exists, throw error
        throw Error(`Container ${containerName} does not exist`);
      }

      return this._blobServiceClient.getContainerClient(containerName);
    } catch (error) {
      this._logger.error(error);
    }
  }

  /**
   * @description Convert a readable stream to a buffer
   *
   * @param readableStream
   */
  private async _streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      readableStream.on('data', (data: Buffer | Uint8Array) => {
        chunks.push(data instanceof Buffer ? data : Buffer.from(data));
      });
      readableStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      readableStream.on('error', reject);
    });
  }

  /**
   * @description Stores a JSON object in a blob storage
   *
   * @param objectToStore - The object to store
   * @param blobName - The name of the blob to store
   */
  async storeObjectInBlob(objectToStore: unknown, blobName: string) {
    try {
      // Get or create the container
      const containerClient: ContainerClient = await this._getContainer(this._containerName);

      // Convert the object to a JSON string
      const jsonString = JSON.stringify(objectToStore);

      // Create a blob client for the specified blob
      const blobClient = containerClient.getBlockBlobClient(blobName);

      // Upload the JSON string to the blob
      const response = await blobClient.upload(jsonString, jsonString.length);
      this._logger.log(`Object stored successfully in blob: ${blobName}`);

      return response;
    } catch (error) {
      this._logger.log(`Error storing object in blob: ${blobName}`);
      this._logger.error(error);
    }
  }

  /**
   * @description Uploads screenshots to blob storage.
   *
   * @param screenshots - The screenshots to upload
   */
  async uploadScreenshotsToBlob(screenshots: string[]) {
    try {
      // Get or create the container
      const containerClient: ContainerClient = await this._getContainer(this._containerName);

      // Upload the screenshots
      for (const screenshot of screenshots) {
        // Create a blob client for the specified blob
        const blobClient = containerClient.getBlockBlobClient(screenshot);

        // Upload the screenshot to the blob
        await blobClient.uploadFile(screenshot);
        this._logger.log(`Screenshot uploaded successfully to blob: ${screenshot}`);
      }
    } catch (error) {
      this._logger.log(`Error uploading screenshots to blob`);
      this._logger.error(error);
    }
  }
}
