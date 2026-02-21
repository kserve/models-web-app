describe('Models Web App - Index Page Tests', () => {
  beforeEach(() => {
    // Mock the configuration API that's loaded during app initialization
    cy.intercept('GET', '/api/config', {
      statusCode: 200,
      body: {
        grafanaPrefix: '/grafana',
        grafanaCpuMemoryDb: 'db/knative-serving-revision-cpu-and-memory-usage',
        grafanaHttpRequestsDb: 'db/knative-serving-revision-http-requests',
        sseEnabled: false,
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

    cy.visit('/');
  });

  it('should load the index page successfully', () => {
    // Verify essential components are rendered
    cy.get('body').should('exist');
    cy.get('app-root').should('exist');
    cy.get('app-index', { timeout: 2000 }).should('exist');
    cy.get('.lib-content-wrapper').should('exist');
  });

  it('should display the page title as "Endpoints"', () => {
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
    // New Endpoint button should be visible
    cy.get('button')
      .contains('New Endpoint', { timeout: 2000 })
      .should('be.visible');
  });

  it('should navigate to /new when clicking "New Endpoint" button', () => {
    // Click and verify navigation
    cy.contains('button', 'New Endpoint', { timeout: 2000 }).click();
    cy.url().should('include', '/new');
    cy.get('app-submit-form').should('exist');
  });

  it('should allow keyboard navigation to buttons', () => {
    // Focus and activate button with keyboard
    cy.contains('button', 'New Endpoint', { timeout: 2000 }).focus();
    cy.focused().should('contain', 'New Endpoint');
    cy.focused().type('{enter}');
    cy.url().should('include', '/new');
  });
});
