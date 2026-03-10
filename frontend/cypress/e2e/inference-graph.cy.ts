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
      url: 'http://test-inference-graph.kubeflow-user.example.com',
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

    cy.intercept('GET', '/api/namespaces', {
      statusCode: 200,
      body: {
        namespaces: [
          {
            name: testNamespace,
            status: 'Active',
          },
        ],
      },
    }).as('getNamespacesList');

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

    cy.intercept('GET', '**/dashboard_lib.bundle.js', {
      statusCode: 200,
      body: '',
    });
  });

  it('should load the inference graphs page successfully', () => {
    cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs`, {
      statusCode: 200,
      body: {
        inferenceGraphs: [],
      },
    }).as('getInferenceGraphsEmpty');

    cy.visit('/inference-graphs');
    cy.wait('@getConfig');

    cy.get('app-inference-graph', { timeout: 5000 }).should('exist');
    cy.contains('InferenceGraph').should('be.visible');
  });

  it('should display inference graphs in a table', () => {
    cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs`, {
      statusCode: 200,
      body: {
        inferenceGraphs: [mockInferenceGraph],
      },
    }).as('getInferenceGraphs');

    cy.visit('/inference-graphs');
    cy.wait('@getConfig');
    cy.wait('@getInferenceGraphs');

    cy.get('app-inference-graph', { timeout: 10000 }).should('exist');

    cy.get('lib-table', { timeout: 10000 }).should('exist');

    cy.contains(testGraphName, { timeout: 10000 }).should('be.visible');
    cy.contains('Sequence', { timeout: 10000 }).should('be.visible');
  });

  it('should navigate to new graph form', () => {
    cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs`, {
      statusCode: 200,
      body: {
        inferenceGraphs: [],
      },
    }).as('getInferenceGraphsEmpty');

    cy.visit('/inference-graphs');
    cy.wait('@getConfig');

    cy.contains('button', 'New InferenceGraph').click();
    cy.url().should('include', '/new-graph');
  });

  it('should create a new inference graph', () => {
    cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs`, {
      statusCode: 200,
      body: {
        inferenceGraphs: [],
      },
    }).as('getInferenceGraphsInitial');

    cy.visit('/inference-graphs');
    cy.wait('@getConfig');
    cy.wait('@getInferenceGraphsInitial');

    cy.intercept(
      'POST',
      `/api/namespaces/${testNamespace}/inferencegraphs`,
      req => {
        req.reply({
          statusCode: 200,
          body: {
            inferenceGraph: mockInferenceGraph,
          },
        });
      },
    ).as('createInferenceGraph');

    cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs`, {
      statusCode: 200,
      body: {
        inferenceGraphs: [mockInferenceGraph],
      },
    }).as('getInferenceGraphsAfterCreate');

    cy.contains('button', 'New InferenceGraph').click();
    cy.url().should('include', '/new-graph');

    const yamlContent = `apiVersion: serving.kserve.io/v1alpha1
kind: InferenceGraph
metadata:
  name: ${testGraphName}
  namespace: ${testNamespace}
spec:
  nodes:
    root:
      routerType: Sequence
      steps:
        - serviceName: sklearn-iris
        - serviceName: xgboost-iris`;

    cy.get('textarea.yaml-editor', { timeout: 5000 })
      .should('be.visible')
      .clear()
      .type(yamlContent, { delay: 0 });
    cy.contains('button', 'CREATE', { timeout: 2000 })
      .should('be.visible')
      .click();

    cy.wait('@createInferenceGraph', { timeout: 10000 });

    cy.url({ timeout: 15000 }).should('include', '/inference-graphs');
    cy.url().should('not.include', '/new-graph');
  });

  it('should display graph details page', () => {
    cy.intercept(
      'GET',
      `/api/namespaces/${testNamespace}/inferencegraphs/${testGraphName}`,
      {
        statusCode: 200,
        body: {
          inferenceGraph: mockInferenceGraph,
        },
      },
    ).as('getInferenceGraph');

    cy.intercept(
      'GET',
      `/api/namespaces/${testNamespace}/inferencegraphs/${testGraphName}/events`,
      {
        statusCode: 200,
        body: [],
      },
    ).as('getEvents');

    cy.visit(`/graph-details/${testNamespace}/${testGraphName}`);
    cy.wait('@getConfig');
    cy.wait('@getInferenceGraph', { timeout: 10000 });
    cy.wait('@getEvents', { timeout: 10000 });

    cy.get('app-graph-info', { timeout: 10000 }).should('exist');

    cy.contains(testGraphName, { timeout: 10000 }).should('be.visible');
    cy.contains('Sequence', { timeout: 10000 }).should('be.visible');
  });

  it('should delete graph when confirmed', () => {
    cy.intercept(
      'GET',
      `/api/namespaces/${testNamespace}/inferencegraphs/${testGraphName}`,
      {
        statusCode: 200,
        body: {
          inferenceGraph: mockInferenceGraph,
        },
      },
    ).as('getInferenceGraph');

    cy.intercept(
      'GET',
      `/api/namespaces/${testNamespace}/inferencegraphs/${testGraphName}/events`,
      {
        statusCode: 200,
        body: [],
      },
    ).as('getEvents');

    cy.intercept(
      'DELETE',
      `/api/namespaces/${testNamespace}/inferencegraphs/${testGraphName}`,
      {
        statusCode: 200,
      },
    ).as('deleteInferenceGraph');

    cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs`, {
      statusCode: 200,
      body: {
        inferenceGraphs: [],
      },
    }).as('getInferenceGraphsAfterDelete');

    cy.visit(`/graph-details/${testNamespace}/${testGraphName}`);
    cy.wait('@getConfig');
    cy.wait('@getInferenceGraph', { timeout: 10000 });
    cy.wait('@getEvents', { timeout: 10000 });

    cy.get('app-graph-info', { timeout: 10000 }).should('exist');
    cy.contains(testGraphName, { timeout: 10000 }).should('be.visible');

    cy.contains('button', 'DELETE', { timeout: 10000 })
      .should('be.visible')
      .scrollIntoView()
      .click({ force: true });

    cy.get('mat-dialog-container', { timeout: 10000 }).should('be.visible');
    cy.get('mat-dialog-container').within(() => {
      cy.contains('button', 'DELETE', { timeout: 5000 }).click();
    });

    cy.wait('@deleteInferenceGraph', { timeout: 10000 });

    cy.url({ timeout: 10000 }).should('include', '/inference-graphs');
    cy.url().should('not.include', '/graph-details');
  });
});
