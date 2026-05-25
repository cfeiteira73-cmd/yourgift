import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testMatch: [
    // Unit tests
    '**/*.spec.ts',
    // Integration tests
    'test/integration/**/*.test.ts',
  ],
  moduleNameMapper: {
    // Map workspace packages to their dist or src equivalents during testing
    '^@yourgift/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@yourgift/midocean$': '<rootDir>/../../packages/midocean/src/index.ts',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.entity.ts',
    '!src/main.ts',
    '!src/instrument.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  globals: {
    'ts-jest': {
      tsconfig: {
        // Allow js files in tests
        allowJs: true,
        // Relax some checks for test files
        strict: false,
      },
    },
  },
  // Increase timeout for integration tests that may involve async setup
  testTimeout: 30_000,
  // Verbose output for CI
  verbose: true,
};

export default config;
