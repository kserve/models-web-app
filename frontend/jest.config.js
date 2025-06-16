module.exports = {
  preset: "jest-preset-angular",
  setupFilesAfterEnv: ["<rootDir>/src/test-setup.jest.ts"],
  testMatch: ["**/*.jest.spec.ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.spec.ts",
    "!src/**/*.jest.spec.ts",
    "!src/main.ts",
    "!src/polyfills.ts",
  ],
  coverageDirectory: "coverage-jest",
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "^kubeflow$": "<rootDir>/__mocks__/kubeflow.ts",
    "^src/(.*)$": "<rootDir>/src/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  transform: {
    "^.+\\.(ts|js|html)$": "jest-preset-angular",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(kubeflow|@angular|rxjs|lodash-es)/)",
  ],
  roots: ["<rootDir>/src"],
  modulePaths: ["<rootDir>/src"],
};
