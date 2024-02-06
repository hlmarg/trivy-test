import { ExecutionResults, GenericResponse } from '../interfaces';
import { HttpService } from './http-service';

export class ApiService {
  private _baseUrl: string;
  private _apiUsername: string;
  private _apiPassword: string;
  private _httpService: HttpService;

  private _token: string;

  constructor() {
    this._baseUrl = process.env.API_INTEGRATION_URL;
    if (!this._baseUrl) {
      throw new Error('API_INTEGRATION_URL environment variable is not set.');
    }

    this._apiUsername = process.env.API_INTEGRATION_USERNAME;
    if (!this._apiUsername) {
      throw new Error('API_INTEGRATION_USERNAME environment variable is not set.');
    }

    this._apiPassword = process.env.API_INTEGRATION_PASSWORD;
    if (!this._apiPassword) {
      throw new Error('API_INTEGRATION_PASSWORD environment variable is not set.');
    }

    this._httpService = new HttpService(this._baseUrl);
  }

  public async authenticate(): Promise<boolean> {
    const response = await this._httpService.post<
      GenericResponse<{
        token: string;
        refreshToken: string;
      }>
    >(`auth/login`, {
      username: this._apiUsername,
      password: this._apiPassword,
    });

    this._token = response.data.token;

    return !!this._token;
  }

  public async sendResults(results: { executionId: number; results: ExecutionResults[] }): Promise<boolean> {
    const response = await this._httpService.post<GenericResponse<number>>(
      `scraper-processing/upload-execution-results`,
      results,
      {
        Authorization: `Bearer ${this._token}`,
      },
    );

    return response.status === 200;
  }
}
