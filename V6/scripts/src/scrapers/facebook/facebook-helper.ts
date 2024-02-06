import { MarketSettingsTypes, MarketVehiclesType } from '../../shared/enums';
import { getMarketSettings, takeTheNearestRadiusValue } from '../../shared/helpers';
import { Market, MarketParams } from '../../shared/interfaces';

/**
 * @description Get the facebook search link for the market
 * @param _market - The market to get the link for
 * @returns The facebook search link
 */
export const getMarketUrl = (_market: Market, params: MarketParams): string => {
  // Get the facebook search link
  const facebookMarketUrl = getMarketSettings(MarketSettingsTypes.FacebookSearchLink, _market.marketSettings)?.replace(
    /\/$/,
    '',
  );

  if (!facebookMarketUrl) {
    throw new Error(`Facebook search link not found for market ${_market.id}`);
  }

  let url = `${facebookMarketUrl}/vehicles`;
  let topLevelVehicleType = '';

  switch (_market.vehiclesType) {
    case MarketVehiclesType.RV:
      topLevelVehicleType = 'rv_camper';
      break;
    default: {
      topLevelVehicleType = 'car_truck';
      break;
    }
  }

  url = `${url}?${new URLSearchParams({
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    maxMileage: params.maxMileage,
    maxYear: params.maxYear,
    minYear: params.minYear,
    sortBy: 'creation_time_descend',
    exact: true,
    topLevelVehicleType: topLevelVehicleType,
  } as any)}`;

  return url;
};

/**
 * @description This function take the nearest radius value from the provided radius and stop it when it finds a match
 */
export const getFacebookRadius = (searchRadius: number) => {
  const radiuses = [1, 2, 5, 10, 20, 40, 60, 80, 100, 250, 500];
  const nearestMiles = takeTheNearestRadiusValue(searchRadius, radiuses);
  const index = radiuses?.findIndex((radius) => radius === nearestMiles) || 0;

  return {
    index,
    value: radiuses[index],
  };
};

/**
 * @description This function converts the total owners string to number
 */
export const convertTotalOwnersStringToNumber = (totalOwnersString: string) => {
  if (totalOwnersString === 'ONE') return 1;
  if (totalOwnersString === 'TWO') return 2;
  if (totalOwnersString === 'THREE') return 3;
  if (totalOwnersString === 'FOUR') return 4;
  if (totalOwnersString === 'FIVE') return 5;
  return null;
};
