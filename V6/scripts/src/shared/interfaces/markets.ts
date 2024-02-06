export interface MarketParams {
  minPrice: number;
  maxPrice: number;
  maxMileage: number;
  maxYear: number;
  minYear: number;
  searchRadius: number;
  daysSinceListed: string | number;
}
