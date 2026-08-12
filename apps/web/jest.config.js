const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Ignore Playwright journey specs; keep e2e/*.test.ts unit coverage.
  testPathIgnorePatterns: ['<rootDir>/e2e/.*\\.spec\\.(ts|tsx|js|jsx)$'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

module.exports = createJestConfig(customJestConfig);
