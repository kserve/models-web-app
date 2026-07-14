describe('Models Web App - Index Page Tests', () => {
  const testEndpointName = 'repeated-hover-endpoint';

  const mockInferenceService = {
    apiVersion: 'serving.kserve.io/v1beta1',
    kind: 'InferenceService',
    metadata: {
      name: testEndpointName,
      namespace: 'kubeflow-user',
      creationTimestamp: '2024-03-09T10:00:00Z',
    },
    spec: {
      predictor: {
        sklearn: {
          storageUri: 'gs://test-bucket/model',
          runtimeVersion: '0.24.1',
          protocolVersion: 'v1',
        },
      },
    },
    status: {
      conditions: [{ type: 'Ready', status: 'True' }],
      url: `http://${testEndpointName}.kubeflow-user.example.com`,
    },
  };

  const newerInferenceService = {
    ...mockInferenceService,
    metadata: {
      ...mockInferenceService.metadata,
      name: 'newer-endpoint',
      creationTimestamp: '2025-04-10T10:00:00Z',
    },
    status: {
      ...mockInferenceService.status,
      url: 'http://newer-endpoint.kubeflow-user.example.com',
    },
  };

  const inferenceServiceWithoutCreationTimestamp = {
    ...mockInferenceService,
    metadata: {
      ...mockInferenceService.metadata,
      name: 'no-creation-timestamp-endpoint',
      creationTimestamp: '',
    },
    status: {
      ...mockInferenceService.status,
      url: 'http://no-creation-timestamp-endpoint.kubeflow-user.example.com',
    },
  };

  beforeEach(() => {
    // Mock the configuration API that's loaded during app initialization
    cy.intercept('GET', '/api/config', {
      statusCode: 200,
      body: {
        grafanaPrefix: '/grafana',
        grafanaCpuMemoryDb: 'db/knative-serving-revision-cpu-and-memory-usage',
        grafanaHttpRequestsDb: 'db/knative-serving-revision-http-requests',
      },
    }).as('getConfig');

    // Set up default intercepts for all tests
    cy.intercept('GET', '/api/config/namespaces', {
      statusCode: 200,
      body: {
        namespaces: ['kubeflow-user'],
      },
    }).as('getNamespaces');

    // Default empty response for inference services
    cy.intercept('GET', '/api/namespaces/*/inferenceservices', {
      statusCode: 200,
      body: [],
    }).as('getInferenceServicesDefault');
  });

  it('should load the index page successfully', () => {
    cy.visit('/');

    // Verify essential components are rendered
    cy.get('body').should('exist');
    cy.get('app-root').should('exist');
    cy.get('app-index', { timeout: 2000 }).should('exist');
    cy.get('.lib-content-wrapper').should('exist');
  });

  it('should display the page title as "Endpoints"', () => {
    cy.visit('/');

    // Check title in toolbar
    cy.get('lib-title-actions-toolbar', { timeout: 2000 }).should('exist');
    cy.get('lib-title-actions-toolbar').should(
      'have.attr',
      'title',
      'Endpoints',
    );
    cy.contains('Endpoints').should('be.visible');
  });

  it('should show namespace selector', () => {
    cy.visit('/');

    // Wait for the config to load first
    cy.wait('@getConfig');
    // Wait for namespaces to be fetched
    cy.wait('@getNamespaces');

    // Namespace selector should be visible
    cy.get('app-namespace-select', { timeout: 5000 }).should('exist');
    cy.get('lib-title-actions-toolbar')
      .find('app-namespace-select')
      .should('exist');
  });

  it('should display the endpoints table with correct columns', () => {
    cy.visit('/');

    // Table component should exist
    cy.get('lib-table', { timeout: 2000 }).should('exist');
    cy.get('.page-padding.lib-flex-grow.lib-overflow-auto')
      .find('lib-table')
      .should('exist');

    // Verify table headers
    cy.get('lib-table').within(() => {
      cy.get('th').should('contain', 'Status');
      cy.get('th').should('contain', 'Name');
      cy.get('th').should('contain', 'Created at');
      cy.get('th').should('contain', 'Predictor');
      cy.get('th').should('contain', 'Runtime');
      cy.get('th').should('contain', 'Protocol');
      cy.get('th').should('contain', 'Storage URI');
    });
  });

  it('should display empty state when no endpoints exist', () => {
    cy.visit('/');

    // With the default empty intercept, verify empty state
    cy.wait('@getNamespaces');
    cy.wait('@getInferenceServicesDefault');

    // Table should exist and show empty state
    cy.get('lib-table', { timeout: 2000 }).should('exist');
    cy.get('lib-table').within(() => {
      cy.contains('No rows to display').should('be.visible');
    });
  });

  it('should display the "New Endpoint" button', () => {
    cy.visit('/');

    // New Endpoint button should be visible
    cy.get('button')
      .contains('New Endpoint', { timeout: 2000 })
      .should('be.visible');
  });

  it('should navigate to /new when clicking "New Endpoint" button', () => {
    cy.visit('/');

    // Click and verify navigation
    cy.contains('button', 'New Endpoint', { timeout: 2000 }).click();
    cy.url().should('include', '/new');
    cy.get('app-submit-form').should('exist');
  });

  it('should allow keyboard navigation to buttons', () => {
    cy.visit('/');

    // Focus and activate button with keyboard
    cy.contains('button', 'New Endpoint', { timeout: 2000 }).focus();
    cy.focused().should('contain', 'New Endpoint');
    cy.focused().type('{enter}');
    cy.url().should('include', '/new');
  });

  it('should avoid name and creation-time hover overlays while preserving navigation', () => {
    const creationTimestampSelector = `td[data-cy-timestamp="${mockInferenceService.metadata.creationTimestamp}"] lib-date-time > .truncate`;
    cy.intercept('GET', '/api/sse/**', {
      statusCode: 503,
      body: { error: 'Unexpected Server-Sent Events request' },
    }).as('unexpectedServerSentEventsRequest');
    cy.intercept('GET', '/api/sse/namespaces/kubeflow-user/inferenceservices', {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: `data: ${JSON.stringify({
        type: 'INITIAL',
        items: [
          newerInferenceService,
          inferenceServiceWithoutCreationTimestamp,
          mockInferenceService,
        ],
      })}\n\n`,
    }).as('watchInferenceServicesForHover');
    cy.intercept('GET', '/api/namespaces/*/inferenceservices', {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: { error: 'Unexpected polling request' },
    }).as('unexpectedPollingRequest');
    cy.intercept(
      'GET',
      `/api/namespaces/kubeflow-user/inferenceservices/${testEndpointName}`,
      {
        statusCode: 200,
        body: {
          inferenceService: mockInferenceService,
        },
      },
    ).as('getInferenceServiceDetails');

    cy.visit('/');
    cy.wait('@watchInferenceServicesForHover');
    cy.contains('a', testEndpointName)
      .should('be.visible')
      .and('have.attr', 'href', `/details/kubeflow-user/${testEndpointName}`);
    cy.get(creationTimestampSelector)
      .should('contain.text', 'ago')
      .and('have.css', 'pointer-events', 'none');

    cy.contains('th', 'Created at').click();
    cy.get('tbody tr td.mat-column-name a').then(endpointLinks => {
      expect(
        [...endpointLinks].map(link => link.textContent.trim()),
      ).to.deep.eq([
        'no-creation-timestamp-endpoint',
        testEndpointName,
        'newer-endpoint',
      ]);
    });

    cy.get('#filterInput').type('Created at: 2025-04-10{enter}');
    cy.get('tbody tr td.mat-column-name a')
      .should('have.length', 1)
      .and('contain.text', 'newer-endpoint');
    cy.get('button[aria-label="Clear"]').click();

    cy.get('#filterInput').type('Created at: -{enter}');
    cy.get('tbody tr td.mat-column-name a')
      .should('have.length', 1)
      .and('contain.text', 'no-creation-timestamp-endpoint');
    cy.get('button[aria-label="Clear"]').click();
    cy.get('#filterInput').type('{esc}');

    Cypress._.times(5, () => {
      cy.contains('a', testEndpointName).trigger('mouseenter');
      cy.wait(150);
      cy.get('lib-popover, .popover-card, .mat-tooltip').should('not.exist');
      cy.contains('a', testEndpointName).trigger('mouseleave');
      cy.wait(150);
      cy.get('lib-popover, .popover-card, .mat-tooltip').should('not.exist');
    });

    Cypress._.times(5, () => {
      cy.get(creationTimestampSelector).parent().trigger('mouseenter');
      cy.wait(150);
      cy.get('lib-popover, .popover-card, .mat-tooltip').should('not.exist');
      cy.get(creationTimestampSelector).parent().trigger('mouseleave');
      cy.wait(150);
      cy.get('lib-popover, .popover-card, .mat-tooltip').should('not.exist');
    });

    cy.contains('a', testEndpointName).trigger('mouseenter');
    cy.get('lib-popover, .popover-card, .mat-tooltip').should('not.exist');
    cy.get('@unexpectedServerSentEventsRequest.all').should('have.length', 0);
    cy.get('@unexpectedPollingRequest.all').should('have.length', 0);

    cy.contains('a', testEndpointName).click();
    cy.url().should('include', `/details/kubeflow-user/${testEndpointName}`);
    cy.wait('@getInferenceServiceDetails');
  });
});
