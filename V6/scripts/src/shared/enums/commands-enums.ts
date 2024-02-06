export enum ScriptType {
  Scraper = 'scraper',
  CookiesGeneration = 'cookie-generation',
  Valuation = 'valuation',
}

export const VALID_SCRIPT_TYPES = Object.values(ScriptType);
