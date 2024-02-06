import { ScrapedVehicle } from './scraped-vehicle';

export interface ExecutionResults {
  executionId: number;
  marketId: number;
  script: string;
  success: boolean;
  startedAt: string;
  endedAt: string;
  executionStatus: string;
  executionMessage: string;

  totalVehicles: number;
  skippedVehicles: number;
  validVehicles: number;
  resultsLink: string;
}

export interface EmailImageAttachment {
  filename: string;
  content: string;
  type: string;
  disposition: string;
}

export interface ScraperResults {
  success: boolean;
  executionStatus: string;
  executionMessage: string;
  totalVehicles: number;
  skippedVehicles: number;
  validVehicles: number;
  results: ScrapedVehicle[];
}

export interface CookieGenerationResults {
  success: boolean;
  executionStatus: string;
  executionMessage: string;
  results: { name: string; cookie: unknown }[];
}
