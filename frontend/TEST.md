# Testing Guide for Models Web Application

This document provides a comprehensive overview of the testing strategy and implementation for the Models Web Application frontend.

## Table of Contents

- [Overview](#overview)
- [Testing Technologies](#testing-technologies)
- [Unit Testing with Jest](#unit-testing-with-jest)
- [Unit Testing with Karma/Jasmine](#unit-testing-with-karmajasmine)
- [End-to-End Testing with Cypress](#end-to-end-testing-with-cypress)
- [Test Organization](#test-organization)
- [Running Tests](#running-tests)

## Overview

The Models Web Application employs a multi-layered testing strategy:

- **Unit Tests**: Testing individual components, services, and utility functions in isolation
- **E2E Tests**: Testing complete user workflows from end-to-end with mocked backend APIs

This approach ensures both code quality at the unit level and functional correctness at the integration level.

## Testing Technologies

### Primary Testing Stack

- **[Jest](https://jestjs.io/)** - Fast unit testing framework with excellent TypeScript support
- **[Karma](https://karma-runner.github.io/)** + **[Jasmine](https://jasmine.github.io/)** - Traditional Angular testing setup (legacy)
- **[Cypress](https://www.cypress.io/)** - Modern E2E testing framework with excellent developer experience

### Supporting Libraries

- `jest-preset-angular` - Jest configuration preset for Angular projects
- `@angular/core/testing` - Angular testing utilities
- `@angular/common/http/testing` - HTTP mocking utilities

## Unit Testing with Jest

Jest is the primary unit testing framework, providing fast test execution and comprehensive coverage reporting.

### Configuration

**Jest Configuration** (`jest.config.js`) includes:
- Test file pattern: `**/*.jest.spec.ts`
- Setup file: `src/test-setup.jest.ts`
- Coverage directory: `coverage-jest`
- Module name mappers for mocking dependencies

### Key Features

- **Test File Pattern**: `*.jest.spec.ts` - All Jest tests use this naming convention
- **Mocking**: External dependencies like `kubeflow` are mocked using `__mocks__/` directory
- **Coverage**: Configured to collect coverage from all source files except test files
- **Module Resolution**: Custom path mappings for cleaner imports

### Mock Files

**Kubeflow Mock** (`__mocks__/kubeflow.ts`):

Provides mock implementations of commonly used Kubeflow types and enums:
- `STATUS_TYPE` - Status types for Kubernetes objects (UNINITIALIZED, TERMINATING, WARNING, READY)
- `Condition` - Interface for Kubernetes conditions
- `K8sObject` - Interface for Kubernetes objects
- `PredictorType` - Enum for different predictor types (Tensorflow, PyTorch, Sklearn, etc.)
- `PredictorExtensionSpec`, `ModelSpec`, `PredictorSpec` - Interfaces for InferenceService specs

### Running Jest Tests

```bash
# Run all Jest tests
npm run test:jest

# Run tests in watch mode
npm run test:jest -- --watch

# Run tests with coverage
npm run test:jest -- --coverage
```

## Unit Testing with Karma/Jasmine

Karma with Jasmine is the traditional Angular testing setup, still used for some legacy tests.

### Configuration

**Karma Configuration** (`karma.conf.js`):
- Framework: Jasmine with Angular DevKit
- Browser: Chrome (ChromeHeadless for CI)
- Coverage: Istanbul reporter with HTML, LCOV, and text-summary formats
- Special proxies for Monaco Editor and assets

### Test File Pattern

Files ending with `.spec.ts` (not `.jest.spec.ts`) run through Karma/Jasmine.

### Running Karma Tests

```bash
# Run tests in watch mode
npm run test

# Run tests once (headless for CI)
npm run test:prod
```

## End-to-End Testing with Cypress

Cypress provides comprehensive E2E testing with **complete backend API mocking**, ensuring tests are fast, reliable, and independent of backend availability.

### Configuration

**Cypress Configuration** (`cypress.config.ts`) includes:
- Base URL: `http://localhost:4200`
- Spec pattern: `cypress/e2e/**/*.cy.ts`
- Viewport: 1280x720
- Screenshots on failure enabled

### Directory Structure

```
cypress/
├── e2e/                    # Test specifications
│   ├── index-page.cy.ts
│   ├── model-deployment.cy.ts
│   ├── model-deletion.cy.ts
│   └── model-edit.cy.ts
├── fixtures/               # Mock data
│   ├── namespaces.json
│   └── inference-services.json
├── support/                # Custom commands and setup
│   ├── commands.ts
│   └── e2e.ts
└── screenshots/            # Test failure screenshots
```

### API Mocking Strategy

All backend API calls are intercepted and mocked using `cy.intercept()`. This ensures:
- **Fast execution** - No network latency
- **Reliability** - No dependency on backend availability
- **Reproducibility** - Consistent test data
- **Error testing** - Easy simulation of error scenarios

### Test Coverage

#### 1. Index Page Tests (`index-page.cy.ts`)

**Scenarios Covered**:
- Page loads successfully with all UI components
- Page title displays correctly as "Endpoints"
- Namespace selector is visible and functional
- Endpoints table displays with correct columns
- Empty state shows when no endpoints exist
- "New Endpoint" button navigates correctly
- Keyboard navigation works properly

#### 2. Model Deployment Tests (`model-deployment.cy.ts`)

**Scenarios Covered**:
- Navigation to submit form via "New Endpoint" button
- Monaco editor loads and is interactive
- Valid YAML submission creates inference service
- Invalid YAML syntax shows error messages
- Network errors are handled gracefully
- Required fields validation works
- Pre-filled templates can be edited

**Key Features**:
- Custom helper function to set Monaco editor value with Angular change detection
- Direct component manipulation for testing edge cases
- Comprehensive API request validation

#### 3. Model Edit Tests (`model-edit.cy.ts`)

**Scenarios Covered**:
- Model details page loads correctly
- Edit mode can be entered
- YAML content displays in editor
- Edited model can be successfully submitted
- Edit can be cancelled
- Submission errors are handled gracefully
- Invalid YAML is validated

#### 4. Model Deletion Tests (`model-deletion.cy.ts`)

**Scenarios Covered**:
- Delete buttons display for inference services
- Deletion with confirmation works correctly
- Deletion can be cancelled
- API errors during deletion are handled
- Confirmation dialog displays properly
- Terminating endpoints show correct status
- Delete button tooltips are visible

### Custom Cypress Commands

Custom commands are defined in `cypress/support/commands.ts`:
- `cy.dataCy(value)` - Select element by data-cy attribute
- `cy.waitForAngular()` - Wait for Angular to stabilize

### Fixtures

Mock data is stored in `cypress/fixtures/`:
- `namespaces.json` - Contains available namespaces
- `inference-services.json` - Contains sample inference services

### Running Cypress Tests

```bash
# Open Cypress Test Runner (interactive)
npm run cypress:open

# Run all tests headlessly
npm run cypress:run:headless

# Run with dev server for debugging
npm run e2e:cypress

# Run in CI mode (with dev server)
npm run e2e:cypress:ci
```

## Test Organization

### File Naming Conventions

- **Jest Unit Tests**: `*.jest.spec.ts`
- **Karma/Jasmine Tests**: `*.spec.ts`
- **Cypress E2E Tests**: `*.cy.ts`

## Running Tests

### Complete Test Suite

```bash
# Install dependencies
npm install

# Run all Jest unit tests
npm run test:jest

# Run Karma/Jasmine tests
npm run test

# Open Cypress for E2E tests
npm run cypress:open

# Run all Cypress tests headlessly
npm run cypress:run:headless
```

### Continuous Integration

For CI/CD pipelines:

```bash
# Unit tests (headless)
npm run test:prod

# E2E tests (headless with dev server)
npm run e2e:cypress:ci
```
