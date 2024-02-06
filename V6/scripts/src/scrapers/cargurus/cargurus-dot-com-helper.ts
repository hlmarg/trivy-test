import { takeTheNearestRadiusValue } from '../../shared/helpers';
import { Market, MarketParams } from 'src/shared/interfaces';

// add the jsdocs comments bellow for this fgunction:

/**
 *
 * @param _market Market
 * @param carsParams MaketParams
 * @returns [MainUrl, paramsString]
 *
 */

const getMarketUrl = (_market: Market, carsParams: MarketParams) => {
  const MAIN_CARGURUS_URL =
    'https://www.cargurus.com/Cars/inventorylisting/viewDetailsFilterViewInventoryListing.action';
  const availableRadiuses = [10, 25, 50, 75, 100];

  const searchParams = {
    distance: takeTheNearestRadiusValue(+carsParams?.searchRadius, availableRadiuses),
    maxPrice: carsParams.maxPrice,
    minPrice: carsParams.minPrice,
    maxMileage: carsParams.maxMileage,
    startYear: carsParams.minYear,
    endYear: carsParams.maxYear,
    zip: _market.zipCode,
    sortDir: 'ASC',
    sortType: 'AGE_IN_DAYS',
    daysOnMarketMax: 10,
    sourceContext: 'carGurusHomePageFSBO',
    inventorySearchWidgetType: 'PRICE',
    sellerHierarchyTypes: 'PRIVATE',
  };

  const searchParamsString = new URLSearchParams(searchParams as any);

  const paramsString = searchParamsString.toString();

  return [`${MAIN_CARGURUS_URL}?${paramsString}`, searchParams];
};

export const cargurusHelper = { getMarketUrl };
