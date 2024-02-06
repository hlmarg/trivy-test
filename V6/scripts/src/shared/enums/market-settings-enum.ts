export enum MarketSettingsTypes {
  Tier = 'tier',
  BookMethods = 'book-methods',
  SearchRadius = 'search-radius',
  SearchMaxMileage = 'search-max-mileage',
  SearchMaxPrice = 'search-max-price',
  SearchMinYear = 'search-min-year',
  SearchMaxYear = 'search-max-year',
  SearchTerms = 'search-terms',
  Sources = 'sources',
  CraigslistLocation = 'craigslist-location',
  FacebookSearchLink = 'search-fb-link',
  Timezone = 'time-zone',
}

export enum MarketTier {
  Demo = 'demo',
  Trial = 'trial',
  Premium = 'premium',
}

export const MARKET_SETTINGS_VALUES = [
  MarketSettingsTypes.Tier,
  MarketSettingsTypes.BookMethods,
  MarketSettingsTypes.SearchRadius,
  MarketSettingsTypes.SearchMaxMileage,
  MarketSettingsTypes.SearchMaxPrice,
  MarketSettingsTypes.SearchMinYear,
  MarketSettingsTypes.SearchMaxYear,
  MarketSettingsTypes.SearchTerms,
  MarketSettingsTypes.Sources,
  MarketSettingsTypes.CraigslistLocation,
  MarketSettingsTypes.FacebookSearchLink,
  MarketSettingsTypes.Timezone,
];

export enum MarketTimezone {
  EST = 'est',
  MST = 'mst',
  PST = 'pst',
  CST = 'cst',
}

export enum MarketVehiclesType {
  Cars = 'cars',
  RV = 'rv',
}
