import axios, { AxiosResponse } from 'axios';

export class HttpService {
  private _baseUrl: string;

  constructor(baseUrl: string) {
    this._baseUrl = baseUrl;
  }

  set baseUrl(url: string) {
    this._baseUrl = url;
  }

  /**
   * @description
   * Makes a GET request to the specified endpoint using the specified query parameters.
   * @param {string} endpoint
   * @param {object} queryParams
   * @param {object} headers
   */
  async get<T>(endpoint: string, queryParams: object, headers: object): Promise<AxiosResponse<any, T>> {
    const url = this._getQueryWithParams(`${this._baseUrl}/${endpoint}`, queryParams);
    if (headers) {
      const response = await axios.get(url, { headers });
      return response.data;
    }

    const response = await axios.get(url);
    return response.data;
  }

  /**
   * @description
   * Makes a POST request to the specified endpoint using the specified JSON payload.
   * @param {string} endpoint
   * @param {object} payload
   */
  async post<T>(endpoint: string, payload: object, headers?: object): Promise<AxiosResponse<any, T>> {
    const url = `${this._baseUrl}/${endpoint}`;
    if (headers) {
      const response = await axios.post(url, payload, { headers });
      return response.data;
    }

    const response = await axios.post(url, payload);
    return response.data;
  }

  /**
   * @description
   * Get the query string with the specified parameters
   * @param {string} query
   * @param {object} params
   */
  private _getQueryWithParams = (query: string, params: object) => {
    Object.keys(params).forEach((key, index) => {
      const value: unknown = params?.[key];
      if (Array.isArray(value)) {
        if (value.length > 0) {
          const newProp = value.join(`&${key}=`);
          query = `${query}${index ? `&${key}=` : `?${key}=`}${newProp}`;
        }
      } else {
        query = `${query}${value || value === false ? `${index ? '&' : '?'}${key}=${value}` : ''}`;
      }
    });
    return query;
  };
}
