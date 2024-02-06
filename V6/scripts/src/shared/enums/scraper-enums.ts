export enum ScraperType {
  Autotrader = 'autotrader',
  Cargurus = 'cargurus',
  Craigslist = 'craigslist',
  Facebook = 'facebook',
  Ksl = 'ksl',
  CarsCom = 'cars.com',
  RVTrader = 'rv-trader',
}

export const VALID_SCRAPER_TYPES = Object.values(ScraperType);
