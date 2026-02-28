describe('Models Web App - InferenceGraph Tests', () => {
  const testGraphName = 'test-inference-graph';
  const testNamespace = 'kubeflow-user';

  const mockInferenceGraph = {
    apiVersion: 'serving.kserve.io/v1alpha1',
    kind: 'InferenceGraph',
    metadata: {
      name: testGraphName,
      namespace: testNamespace,
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    spec: {
      nodes: {
        root: {
          routerType: 'Sequence',
          steps: [
            { serviceName: 'sklearn-iris' },
            { serviceName: 'xgboost-iris' },
          ],
        },
      },
    },
    status: {
      conditions: [
        {
          type: 'Ready',
          status: 'True',
          lastTransitionTime: '2024-01-01T00:00:00Z',
        },
      ],
    },
  };

  beforeEach(() => {
    cy.intercept('GET', '/api/config', {
      statusCode: 200,
      body: {
        grafanaPrefix: '/grafana',
        grafanaCpuMemoryDb: 'db/knative-serving-revision-cpu-and-memory-usage',
        grafanaHttpRequestsDb: 'db/knative-serving-revision-http-requests',
      },
    }).as('getConfig');

    cy.intercept('GET', '/api/config/namespaces', {
      statusCode: 200,
      body: {
        namespaces: [testNamespace],
      },
    }).as('getNamespaces');

    cy.intercept('GET', '/api/namespaces/*/inferenceservices', {
      statusCode: 200,
      body: [],
    }).as('getInferenceServices');
  });

  describe('InferenceGraph List Page', () => {
    it('should load the inference graphs page successfully', () => {
      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs`, {
        statusCode: 200,
        body: [],
      }).as('getInferenceGraphsEmpty');

      cy.visit('/inference-graphs');
      cy.wait('@getConfig');
      cy.wait('@getNamespaces');

      cy.get('app-inference-graph', { timeout: 2000 }).should('exist');
    });

    it('should display page title as "InferenceGraphs"', () => {
      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs`, {
        statusCode: 200,
        body: [],
      }).as('getInferenceGraphsEmpty');

      cy.visit('/inference-graphs');
      cy.wait('@getConfig');

      cy.get('lib-title-actions-toolbar', { timeout: 2000 }).should('exist');
      cy.contains('InferenceGraph').should('be.visible');
    });

    it('should show "View Endpoints" and "New InferenceGraph" buttons', () => {
      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs`, {
        statusCode: 200,
        body: [],
      }).as('getInferenceGraphsEmpty');

      cy.visit('/inference-graphs');
      cy.wait('@getConfig');

      cy.contains('button', 'View Endpoints', { timeout: 2000 }).should('be.visible');
      cy.contains('button', 'New InferenceGraph').should('be.visible');
    });

    it('should navigate to new graph form when clicking "New InferenceGraph" button', () => {
      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs`, {
        statusCode: 200,
        body: [],
      }).as('getInferenceGraphsEmpty');

      cy.visit('/inference-graphs');
      cy.wait('@getConfig');

      cy.contains('button', 'New InferenceGraph').click();

      cy.url().should('include', '/new-graph');
    });

    it('should navigate to endpoints page when clicking "View Endpoints" button', () => {
      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs`, {
        statusCode: 200,
        body: [],
      }).as('getInferenceGraphsEmpty');

      cy.visit('/inference-graphs');
      cy.wait('@getConfig');

      cy.contains('button', 'View Endpoints').click();

      cy.url().should('match', /\/$|\/$/);
    });
  });

  describe('InferenceGraph Details', () => {
    beforeEach(() => {
      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs/${testGraphName}`, {
        statusCode: 200,
        body: mockInferenceGraph,
      }).as('getInferenceGraph');

      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs/${testGraphName}/events`, {
        statusCode: 200,
        body: [
          {
            type: 'Normal',
            reason: 'Created',
            message: 'InferenceGraph created successfully',
            lastTimestamp: '2024-01-01T00:00:00Z',
          },
        ],
      }).as('getEvents');
    });

    it('should display graph details page', () => {
      cy.visit(`/graph-details/${testNamespace}/${testGraphName}`);
      cy.wait('@getInferenceGraph');

      cy.get('app-graph-info', { timeout: 2000 }).should('exist');
    });

    it('should display Edit and Delete buttons', () => {
      cy.visit(`/graph-details/${testNamespace}/${testGraphName}`);
      cy.wait('@getInferenceGraph');

      cy.contains('button', 'EDIT', { timeout: 2000 }).should('be.visible');
      cy.contains('button', 'DELETE').should('be.visible');
    });
  });
});
