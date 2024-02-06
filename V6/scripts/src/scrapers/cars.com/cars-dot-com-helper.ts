import { takeTheNearestRadiusValue } from '../../shared/helpers';
import { Market, MarketParams } from '../../shared/interfaces';

/**
 * @description Get the market search link
 * @param _market - The market to get the link for
 * @param params - The parameters to use for the search
 */
export const getMarketUrl = (_market: Market, params?: MarketParams): string => {
  // Search settings
  const availableRadiuses = [10, 20, 30, 40, 50, 75, 100, 150, 200];

  const searchParams = new URLSearchParams({
    dealer_id: '',
    keyword: '',
    maximum_distance: takeTheNearestRadiusValue(+params?.searchRadius, availableRadiuses),
    list_price_max: params.maxPrice,
    list_price_min: params.minPrice,
    mileage_max: params.maxMileage,
    year_min: params.minYear,
    year_max: params.maxYear,
    page_size: 100,
    sort: 'listed_at_desc',
    stock_type: 'used',
    zip: _market.zipCode,
  } as any);

  const paramsString = searchParams.toString();

  const url = `https://www.cars.com/shopping/results`;
  return `${url}?${paramsString}&seller_type[]=private_seller&makes[]=`;
};

export interface CarsDotComVehicleList {
  name: string;
  position: number;
  url: string;
  '@type': string;
}

export interface CarsDotComVehicleData {
  name: string;
  description: string;
  image: {
    '@type': string;
    contentUrl: string;
  };
  '@context': string;
  color: string;
  '@type': string;
  fuelType: string;
  additionalProperty: unknown[];
  fuelEfficiency: string;
  vehicleEngine: {
    name: string;
    '@type': string;
  };
  brand: {
    name: string;
    '@type': string;
  };
  driveWheelConfiguration: string;
  itemCondition: string;
  mileageFromOdometer: string;
  vehicleIdentificationNumber: string;
  vehicleTransmission: string;
}
