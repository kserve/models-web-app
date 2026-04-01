# Testing Guide for Models Web Application

This document describes the active testing stack for the frontend.

## Overview

The frontend uses two test layers:

- Unit tests with Jest.
- End-to-end tests with Cypress.

### Integration Testing on Kubernetes

For cluster-level integration testing, use:

- https://github.com/kubeflow/manifests/blob/master/tests/kserve_models_web_application_test.sh

## Unit Testing with Jest

Jest is the unit test runner.

### Configuration

Jest is configured in `jest.config.js`:

- Setup file: `src/test-setup.jest.ts`
- Test file pattern: `*.jest.spec.ts`
- Coverage output: `coverage-jest`

### Running Unit Tests

```bash
# Run all unit tests
npm run test

# Alias for unit tests
npm run test:jest

# CI-oriented unit test command
npm run test:prod

# Run with watch mode
npm run test -- --watch

# Run with coverage
npm run test -- --coverage
```

## End-to-End Testing with Cypress

Cypress is the only E2E framework.

### Running E2E Tests

```bash
# Open Cypress interactively
npm run cypress:open

# Run Cypress headless (requires app already running)
npm run cypress:run:headless

# Start dev server and open Cypress
npm run e2e:cypress

# CI mode: start dev server and run Cypress headless
npm run e2e:cypress:ci

# Default e2e alias
npm run e2e
```

## Test File Naming

- Jest unit tests: `*.jest.spec.ts`
- Cypress tests: `*.cy.ts`
