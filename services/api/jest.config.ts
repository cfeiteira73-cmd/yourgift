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
    // Security / penetration simulation tests
    'test/security/**/*.test.ts',
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
        allowJs: true,
        strict: false,
        types: ['jest', 'node'],
        esModuleInterop: true,
      },
    },
  },
  // Increase timeout for integration tests that may involve async setup
  testTimeout: 30_000,
  // Verbose output for CI
  verbose: true,
};

export default config;
