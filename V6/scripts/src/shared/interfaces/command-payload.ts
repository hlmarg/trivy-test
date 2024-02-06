import { ScriptType, ScraperType, MarketSettingsTypes, MarketVehiclesType, CookiesType } from '../enums';

export interface CommandPayload {
  id: number;
  type: ScriptType;
}

export interface CookiePayload extends CommandPayload {
  id: number;
  type: ScriptType.CookiesGeneration;
  platform: CookiesType;
  accounts: { name: string; password: string }[];
}

export interface ScraperPayload extends CommandPayload {
  id: number;
  type: ScriptType.Scraper;
  scraper: ScraperType;
  markets: Market[];
}

export interface Market {
  id: number;
  executionId: number;
  location: string;
  zipCode: string;
  dealershipGroupId: number;
  vehiclesType: MarketVehiclesType;
  marketSettings: {
    name: MarketSettingsTypes;
    value: string;
  }[];
  blockedUsers: {
    username: string;
  }[];
  dealershipGroup: {
    name: string;
  };
}
