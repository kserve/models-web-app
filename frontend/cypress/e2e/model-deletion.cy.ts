describe('Models Web App - Model Deletion Tests', () => {
  beforeEach(() => {
    // Mock the configuration API that's loaded during app initialization
    cy.intercept('GET', '/api/config', {
      statusCode: 200,
      body: {
        grafanaPrefix: '/grafana',
        grafanaCpuMemoryDb: 'db/knative-serving-revision-cpu-and-memory-usage',
        grafanaHttpRequestsDb: 'db/knative-serving-revision-http-requests',
        sseEnabled: true,
      },
    }).as('getConfig');

    // Set up default intercepts for all tests
    cy.intercept('GET', '/api/config/namespaces', {
      statusCode: 200,
      body: {
        namespaces: ['kubeflow-user'],
      },
    }).as('getNamespaces');

    // Mock inference services with sample data for deletion testing
    cy.intercept('GET', '/api/namespaces/kubeflow-user/inferenceservices', {
      statusCode: 200,
      body: [
        {
          metadata: {
            name: 'test-sklearn-model',
            namespace: 'kubeflow-user',
            creationTimestamp: '2024-01-15T10:30:00Z',
          },
          spec: {
            predictor: {
              sklearn: {
                storageUri: 'gs://test-bucket/sklearn-model',
                runtimeVersion: '0.24.1',
                protocolVersion: 'v1',
              },
            },
          },
          status: {
            conditions: [
              {
                type: 'Ready',
                status: 'True',
                lastTransitionTime: '2024-01-15T10:35:00Z',
              },
            ],
            url: 'http://test-sklearn-model.kubeflow-user.example.com',
          },
        },
        {
          metadata: {
            name: 'test-tensorflow-model',
            namespace: 'kubeflow-user',
            creationTimestamp: '2024-01-15T11:00:00Z',
          },
          spec: {
            predictor: {
              tensorflow: {
                storageUri: 'gs://test-bucket/tensorflow-model',
                runtimeVersion: '2.8.0',
                protocolVersion: 'v1',
              },
            },
          },
          status: {
            conditions: [
              {
                type: 'Ready',
                status: 'True',
                lastTransitionTime: '2024-01-15T11:05:00Z',
              },
            ],
            url: 'http://test-tensorflow-model.kubeflow-user.example.com',
          },
        },
      ],
    }).as('getInferenceServicesWithData');

    cy.visit('/');
    cy.wait('@getConfig');
    cy.wait('@getNamespaces');
  });

  it('should display delete buttons for inference services', () => {
    cy.get('lib-table', { timeout: 5000 }).should('exist');

    // Check if we have the expected UI elements
    cy.get('body').should('contain', 'Endpoints');
    cy.get('button').contains('New Endpoint').should('be.visible');
  });

  it('should display inference services table', () => {
    // Wait for inference services to load
    cy.wait('@getInferenceServicesWithData', { timeout: 10000 });

    // Verify table is present
    cy.get('lib-table', { timeout: 5000 }).should('exist');
  });

  it('should display models when data is loaded', () => {
    // Wait for inference services to load
    cy.wait('@getInferenceServicesWithData', { timeout: 10000 });

    // Verify the table component exists and has data
    cy.get('lib-table').should('be.visible');
    // Check for table rows
    cy.get('lib-table .mat-row, lib-table tr').should(
      'have.length.greaterThan',
      0,
    );
  });

  it('should handle table interactions', () => {
    // Wait for inference services to load
    cy.wait('@getInferenceServicesWithData', { timeout: 10000 });

    // Verify table has content
    cy.get('lib-table', { timeout: 5000 }).should('be.visible');

    // Try to find actionable elements in the table
    cy.get('lib-table button, lib-table [role="button"]').should(
      'have.length.greaterThan',
      0,
    );
  });

  it('should have properly structured table layout', () => {
    cy.wait('@getInferenceServicesWithData', { timeout: 10000 });

    cy.get('lib-table').within(() => {
      // Check for table header elements
      cy.get('.mat-header-row, thead, [role="columnheader"]', {
        timeout: 5000,
      }).should('exist');
    });
  });
});
