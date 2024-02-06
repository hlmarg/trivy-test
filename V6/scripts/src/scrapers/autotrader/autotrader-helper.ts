import { takeTheNearestRadiusValue } from '../../shared/helpers';
import { Market, MarketParams } from '../../shared/interfaces';

/**
 * @description Get the market payload
 * @param _market - The market to scrape
 * @param params - The market params
 * @param city - The city
 * @param state - The state
 * @returns The market payload
 */
export const getMarketPayload = (_market: Market, params: MarketParams): any => {
  const radiuses = [10, 25, 50, 75, 100, 200, 300];

  // Based on the following url, build the params
  // 'https://www.autotrader.com/cars-for-sale/all-cars/by-owner/cars-between-2900-and-200000/chico-ca?endYear=2023&isNewSearch=false&maxMileage=100000&searchRadius=100&sortBy=datelistedDESC&startYear=2014&zip=95926';

  // Search settings
  return {
    searchRadius: takeTheNearestRadiusValue(params.searchRadius, radiuses),
    maxPrice: params.maxPrice,
    minPrice: params.minPrice,
    maxMileage: params.maxMileage,
    startYear: params.minYear,
    endYear: params.maxYear,
    isNewSearch: true,
    showAccelerateBanner: false,
    sortBy: 'datelistedDESC',
    zip: _market.zipCode,
  };
};

export interface AutotraderListing {
  id: string; // "700427993"
  market_time_zone: string; // "America/Los_Angeles"
  year: number; // 2017
  state: string; // "CA"
  market: string; // "Sacramento"
  legacy_at_listing: boolean; // false
  vdp_heading: string; // "Used 2017 Jaguar XF XF 20d Prestige Sedan 4D"
  suggested_starting_price: number; // 17669
  model: string; // "XF"
  full_style_name: string; // "20d Prestige RWD"
  kbb_trade_in_good: number; // 12982
  submitted_for_review: string; // "2023-11-29T22:57:30.946Z"
  make: string; // "Jaguar"
  trim: string; // "20d Prestige Sedan 4D"
  style_id: string; // "383158"
  submarket: string; // "Sacramento"
  kbb_trade_in_very_good: number; // 14221
  kbb_trade_in_fair: number; // 12037
  inservice_date: string; // "11/21/2017"
  kbb_wholesale: number; // 16231
  suggested_option_value: number; // 0
  option_ids: string[]; // []
  default_test_drive_location_short_address: string; // "Lincoln Blvd, Placer County, US"
  make_id: string; // "20"
  default_test_drive_location_latitude: number; // 38.878012
  updated: string; // "2023-12-11T16:26:14.083Z"
  vin: string; // "SAJBE4BN8HCY43403"
  published: string; // "2023-11-29T22:57:40.180Z"
  status: number; // 0
  body_style: string; // "4dr Car"
  vv_kbb_retail: number; // 19683
  kbb_trade_in_excellent: number; // 15308
  mileage: number; // 80900
  cs_listing_id: string; // "700427993"
  default_test_drive_location_longitude: number; // -121.294202
  model_id: string; // "29199"
  default_test_drive_location_address: string; // "67 Lincoln Blvd, Lincoln, CA 95648, USA"
  images: {
    url: string; // "https://images.autotrader.com/scaler/620/420/cms/images/cars/jaguar/xf/2017/2017jaguarxf/258768.jpg"
  }[];
  price: number; // 17669
  vdp_url: string;
  consignment_form: {
    car_loan: boolean; // false
    car_lease: boolean; // false
    has_title: boolean; // true
  };
  description: string; // "Jaguar Certified Pre-Owned XF Prestige 20D with CPO Warranty Remaining Until December 19, 2023. I am the second owner and purchased this from Jaguar Thousand Oaks in Southern Californian February '21 were it had been serviced since new. Since then all service has been done at Jaguar Land Rover of Rocklin, CA.<br /><br />Never been in an accident and mechanically perfect. I am very fastidious about my cars and a full inspection was done on Nov 2023 with no issues found and all paperwork from every service is in hand. Fully registered until December of 2024.<br /><br />The 80,000 mile service ($950) was just done at Jaguar Land Rover November 2023. I have had the oil changed every 5000 miles (the service manual calls for every 20,000 miles).<br /><br />I spent several months looking for a loaded Jaguar XF with the diesel engine. They are hard to come by in the US optioned like this. This one has every package except for the comfort and convince package but soft close doors etc weren't that important to me. The LED headlights on this are fantastic. The two wide screen displays house digital. Engine instrumenhts/speedo and the onboard navigation. <br /><br />Apple Car Play is is great but I actually prefer the onboard navigation. It has real time traffic and the map and data subscription is good for 3
  public_seller_info: {
    first_name: string; // "Michael"
  };
}
