/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'jest-puppeteer',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/src/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  testTimeout: 20000,
};
