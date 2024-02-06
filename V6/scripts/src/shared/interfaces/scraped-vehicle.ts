// Based off src/scraper/dtos/scraper-vehicle.dto.ts on vettx-api
export interface ScrapedVehicle {
  vehicleOriginalId: string | number;
  title: string;
  originalTitle: string;
  askingPrice: number;
  description: string;
  images: string[];
  totalOwners: number;
  mileage: number;
  sellerName: string;
  listingDate: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  sellerPhone: string;
  sellerEmail: string;
  suspectedDealer: boolean;
  vin: string;
  link: string;
}
