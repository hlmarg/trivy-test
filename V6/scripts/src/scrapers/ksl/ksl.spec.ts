import { makeApiRequest, buildRequestBody, executeScraper } from './index';
import axios from 'axios';
import fs from 'fs';
import { sleep } from '../../shared/helpers';
import { Market, ScraperResults } from '../../shared/interfaces';
import { MarketVehiclesType } from '../../shared/enums';

jest.mock('axios');
jest.mock('luxon');
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
  },
}));
jest.mock('../../shared/helpers', () => ({
  sleep: jest.fn(),
  getParams: jest.fn(() => {
    return {
      minYear: 1990,
      maxYear: 2024,
      maxMileage: 120000,
      maxPrice: 13000,
    };
  }),
  takeTheNearestRadiusValue: jest.fn(() => 10),
  hasIgnoreTerm: jest.fn(() => false),
}));
jest.mock('./ksl-helper', () => ({
  processVehicleData: jest.fn(),
}));

const generateMockPhotos = (memberId) => [
  {
    width: 800,
    description: '2003 BMW E46 CSL (6 SPEED MANUAL)',
    id: `https://img.ksl.com/us/mplace-cars.ksl.com/${memberId}-1683143765-452983.jpg`,
    height: 552,
  },
  // Add more photo objects as needed
];

const generateMockBudget = () => ({
  estimatedMonthlyPayment: 376.3285529167322,
  interestRate: 18,
  loanTerm: '72',
  downPayment: '2500',
});

describe('executeScraper', () => {
  const GASOLINE = 'Gasoline';
  const ORANGE = 'Orange';
  const AUTOMATIC = 'Automatic';
  const mockBody = [
    "perPage",
    24,
    "page",
    1,
    "yearFrom",
    1990,
    "yearTo",
    2022,
    "mileageFrom",
    0,
    "mileageTo",
    120000,
    "priceTo",
    13000,
    "newUsed",
    "Used",
    "sellerType",
    "For Sale By Owner",
    "zip",
    "170103",
    "miles",
    10,
    "includeFacetCounts",
    1,
    "sort",
    0,
  ];

  const mockResponse = [
    {
      numberDoors: 2,
      favorites: 63,
      newUsed: 'Used',
      displayTime: 1703327602,
      titleType: 'Clean Title',
      city: 'Denver',
      fuel: GASOLINE,
      paint: [ORANGE],
      body: 'Coupe',
      reducedPriceStartDate: 1694479701,
      modifyTime: 1703327603,
      trim: 'Base',
      price: 19000,
      vin: 'WBSLB94443JR21941',
      model: 'M3',
      id: 8537537,
      state: 'CO',
      make: 'BMW',
      memberId: 4802425,
      mileage: 173500,
      contactMethod: ['text'],
      zip: '80222',
      makeYear: 2003,
      photo: generateMockPhotos(4802425),
      firstName: 'Max',
      expireTime: 1705912601,
      createTime: 1643166258,
      previousLowPrice: 17000,
      sellerType: 'For Sale By Owner',
      status: 'Active',
      favoritedByCurrentUser: false,
      budget: generateMockBudget(),
    },
    {
      numberDoors: 4,
      favorites: 1,
      newUsed: 'Used',
      displayTime: 1702354446,
      titleType: 'Clean Title',
      city: 'Broomfield',
      paint: ['Silver'],
      body: 'SUV',
      modifyTime: 1702354431,
      transmission: AUTOMATIC,
      trim: 'Latitude',
      price: 7500,
      vin: '1C4NJRFB0ED588854',
      model: 'Patriot',
      id: 7516805,
      state: 'CO',
      make: 'Jeep',
      memberId: 325501,
      mileage: 120000,
      contactMethod: ['calls'],
      zip: '80023',
      makeYear: 2014,
      photo: generateMockPhotos(325501),
      firstName: 'Ben',
      expireTime: 1704946444,
      createTime: 1635318710,
      sellerType: 'For Sale By Owner',
      status: 'Active',
      favoritedByCurrentUser: false,
      budget: generateMockBudget(),
    },
  ];
  
 
  test('should build request body with default values when no carsParams provided', () => {
    const carsParams = {
      minYear: 1990,
      maxYear: 2022
    }
    const market: Market = {
      id: 1,
      executionId: 1,
      location: 'San Francisco',
      zipCode: '170103',
      dealershipGroupId: 1,
      vehiclesType: MarketVehiclesType.Cars,
      marketSettings: [], blockedUsers: [], dealershipGroup: {
        name: 'Vettx'
      }
    };
    const page = 1;

    const result = buildRequestBody(carsParams, market, page);

    expect(result).toEqual(mockBody);
  });

  test('should build request body with provided values from carsParams', () => {
    const carsParams = {
      minYear: 1990,
      maxYear: 2022,
      // Include other carsParams properties here
    };
    const market: Market = {
      id: 1,
      executionId: 1,
      location: 'San Francisco',
      zipCode: '170103',
      dealershipGroupId: 1,
      vehiclesType: MarketVehiclesType.Cars,
      marketSettings: [], blockedUsers: [], dealershipGroup: {
        name: 'Vettx'
      }
    };

    const page = 1;
    const result = buildRequestBody(carsParams, market, page);

    expect(result).toEqual(mockBody);
  });

  test('should make API request and return data', async () => {
    const mockData = {
      data: {
        data: {
          count: 10,
          items: [
            {
              numberDoors: 2,
              favorites: 63,
              newUsed: 'Used',
              displayTime: 1703327601,
              titleType: 'Clean Title',
              city: 'NewYork',
              fuel: GASOLINE,
              paint: ['Black'],
              body: 'Coupe',
              reducedPriceStartDate: 1694479703,
              modifyTime: 170332700,
              trim: 'Base',
              price: 23500,
              vin: 'WBSBL93443JR21941',
              model: 'M3X',
              id: 8537537,
              state: 'CO',
              make: 'BMW',
              memberId: 4802425,
              mileage: 188500,
              contactMethod: ['messages'],
              zip: '80221',
              makeYear: 2003,
              photo: [
                {
                  width: 600,
                  id: 'https://img.ksl.com/mx/mplace-cars.ksl.com/4802425-1683143859-670519.jpg',
                  height: 585,
                },
                {
                  width: 618,
                  id: 'https://img.ksl.com/mx/mplace-cars.ksl.com/4802425-1683143868-362539.jpg',
                  height: 567,
                },
                {
                  width: 809,
                  id: 'https://img.ksl.com/mx/mplace-cars.ksl.com/4802425-1683145737-356172.jpg',
                  height: 453,
                },
                {
                  width: 811,
                  id: 'https://img.ksl.com/mx/mplace-cars.ksl.com/4802425-1683145739-196328.jpg',
                  height: 444,
                },
                {
                  width: 812,
                  id: 'https://img.ksl.com/mx/mplace-cars.ksl.com/4802425-5678-90728.jpg',
                  height: 450,
                },
              ],
              firstName: 'pk',
              expireTime: 1705919601,
              createTime: 1683166258,
              previousLowPrice: 19000,
              sellerType: 'For Sale By Owner',
              status: 'Inactive',
              favoritedByCurrentUser: false,
              budget: {
                estimatedMonthlyPayment: 376.328552457322,
                interestRate: 18,
                loanTerm: '72',
                downPayment: '2500',
              },
            },
            {
              numberDoors: 4,
              favorites: 1,
              newUsed: 'Used',
              displayTime: 1702354446,
              titleType: 'Clean Title',
              city: 'Broomfield',
              paint: ['Silver'],
              body: 'SUV',
              modifyTime: 1702354431,
              transmission: AUTOMATIC,
              trim: 'trimExample',
              price: 7500,
              vin: '1C4NJRFB0EDAB456',
              model: 'Patriot',
              id: 7516805,
              state: 'CO',
              make: 'Jeep',
              memberId: 325501,
              mileage: 120000,
              contactMethod: ['sms'],
              zip: '80023',
              makeYear: 2014,
              photo: [
                {
                  width: 451,
                  id: 'https://img.ksl.com/mx/mplace-cars.ksl.com/325501-1702329194-107270.jpg',
                  height: 611,
                },
                {
                  width: 890,
                  id: 'https://img.ksl.com/mx/mplace-cars.ksl.com/325501-1702329197-130450.jpg',
                  height: 599,
                },
                {
                  width: 449,
                  id: 'https://img.ksl.com/mx/mplace-cars.ksl.com/325501-1702329200-483907.jpg',
                  height: 600,
                },
                {
                  width: 411,
                  id: 'https://img.ksl.com/mx/mplace-cars.ksl.com/325501-1702329203-843820.jpg',
                  height: 600,
                },
                {
                  width: 412,
                  id: 'https://img.ksl.com/mx/mplace-cars.ksl.com/325501-1702329207-662622.jpg',
                  height: 600,
                },
                {
                  width: 413,
                  id: 'https://img.ksl.com/mx/mplace-cars.ksl.com/325501-1702329210-797243.jpg',
                  height: 600,
                },
                {
                  width: 460,
                  id: 'https://img.ksl.com/mx/mplace-cars.ksl.com/325501-1702329213-339204.jpg',
                  height: 609,
                },
                {
                  width: 820,
                  id: 'https://img.ksl.com/mx/mplace-cars.ksl.com/325501-1702329216-88708.jpg',
                  height: 610,
                },
                {
                  width: 450,
                  id: 'https://img.ksl.com/mx/mplace-cars.ksl.com/325501-1702329220-97935.jpg',
                  height: 699,
                },
                {
                  width: 450,
                  id: 'https://img.ksl.com/mx/mplace-cars.ksl.com/325501-1702329223-936506.jpg',
                  height: 551,
                },
                {
                  width: 450,
                  id: 'https://img.ksl.com/mx/mplace-cars.ksl.com/325501-1702329226-844506.jpg',
                  height: 567,
                },
              ],
              firstName: 'Benito',
              expireTime: 1704946431,
              createTime: 1635318709,
              sellerType: 'For Sale By Owner',
              status: 'Active',
              favoritedByCurrentUser: false,
              budget: {
                estimatedMonthlyPayment: 89.48383812696561,
                interestRate: 8.74,
                loanTerm: '45',
                downPayment: '2500',
              },
            },
          ],
        },
      },
    };

    // Mock Axios post method to resolve with mock data
    (axios.post as jest.Mock).mockResolvedValue(mockData);

    const payload = {
      endpoint: '/classifieds/cars/search/searchByUrlParams',
      options: {
        query: {
          returnCount: 24,
        },
        body: mockBody,
        headers: {},
      },
    };
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'cars-node',
      'X-DDM-EVENT-USER-AGENT': {
        ua: 'Chrome/120.0.0.0 Safari/537.36',
        browser: { name: 'Chrome', version: '1.0.0.0', major: '120' },
        engine: { name: 'Blink', version: '2.0.0.0' },
        os: { name: 'Mac OS', version: '10.15.7' },
        device: { vendor: 'Apple', model: 'Macintosh' },
        cpu: {},
      },
      'X-App-Source': 'frontline',
      'X-DDM-EVENT-ACCEPT-LANGUAGE': 'en-UK',
      'X-MEMBER-ID': null,
      cookie: '',
    };
    
    const result = await makeApiRequest(payload, headers);

    expect(result).toEqual(mockData.data.data);
    expect(axios.post).toHaveBeenCalled();
  });

  it('should execute scraper and return results', async () => {
    const mockMarket: Market = {
      id: 1,
      executionId: 1,
      location: 'test',
      zipCode: 'test',
      dealershipGroupId: 1,
      vehiclesType: MarketVehiclesType.Cars,
      blockedUsers: [],
      dealershipGroup: {
        name: 'test',
      },
      marketSettings: [],
    };
    const mockLogger: any = {
      log: jest.fn(),
      error: jest.fn(),
    };

    const mockAxiosResponse = {
      data: {
        data: {
          count: 2,
          items: mockResponse,
          facets: {
            make: [
              {
                key: 'BMW',
                doc_count: 1,
              },
              {
                key: 'Jeep',
                doc_count: 1,
              },
            ],
            model: [
              {
                key: 'M3',
                doc_count: 1,
              },
              {
                key: 'Patriot',
                doc_count: 1,
              },
            ],
            trim: [
              {
                key: 'Base',
                doc_count: 1,
              },
              {
                key: 'Latitude',
                doc_count: 1,
              },
            ],
            titleType: [
              {
                key: 'Clean Title',
                doc_count: 2,
              },
            ],
            body: [
              {
                key: 'Coupe',
                doc_count: 1,
              },
              {
                key: 'SUV',
                doc_count: 1,
              },
            ],
            transmission: [
              {
                key: AUTOMATIC,
                doc_count: 1,
              },
            ],
            liters: [
              {
                key: '3.2L',
                doc_count: 1,
              },
            ],
            fuel: [
              {
                key: GASOLINE,
                doc_count: 1,
              },
            ],
            drive: [
              {
                key: 'RWD',
                doc_count: 1,
              },
            ],
            paint: [
              {
                key: 'Red',
                doc_count: 1,
              },
              {
                key: 'Gold',
                doc_count: 1,
              },
            ],
            upholstery: [
              {
                key: 'Purple',
                doc_count: 1,
              },
              {
                key: 'Tyle',
                doc_count: 1,
              },
            ],
            exteriorCondition: [
              {
                key: 'Excellent',
                doc_count: 1,
              },
            ],
            interiorCondition: [
              {
                key: 'Clean',
                doc_count: 1,
              },
              {
                key: 'Good',
                doc_count: 1,
              },
            ],
            cabSize: [],
            bedSize: [],
          },
          aggregate: [],
          parsedKeywordParams: [],
        },
      },
    };

    (axios.post as jest.Mock).mockResolvedValue(mockAxiosResponse);
    (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
    (sleep as jest.Mock).mockResolvedValue(undefined);

    const results: ScraperResults = await executeScraper(mockMarket, mockLogger);

    expect(results).toBeDefined();
    expect(results.success).toBeTruthy();
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});
