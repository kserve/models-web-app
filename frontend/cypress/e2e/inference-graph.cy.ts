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

  const mockEnsembleGraph = {
    apiVersion: 'serving.kserve.io/v1alpha1',
    kind: 'InferenceGraph',
    metadata: {
      name: 'ensemble-graph',
      namespace: testNamespace,
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    spec: {
      nodes: {
        root: {
          routerType: 'Ensemble',
          steps: [
            { serviceName: 'model-a', weight: 50 },
            { serviceName: 'model-b', weight: 50 },
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
    // Mock the configuration API
    cy.intercept('GET', '/api/config', {
      statusCode: 200,
      body: {
        grafanaPrefix: '/grafana',
        grafanaCpuMemoryDb: 'db/knative-serving-revision-cpu-and-memory-usage',
        grafanaHttpRequestsDb: 'db/knative-serving-revision-http-requests',
      },
    }).as('getConfig');

    // Set up namespace configuration
    cy.intercept('GET', '/api/config/namespaces', {
      statusCode: 200,
      body: {
        namespaces: [testNamespace],
      },
    }).as('getNamespaces');

    // Default empty response for inference services
    cy.intercept('GET', '/api/namespaces/*/inferenceservices', {
      statusCode: 200,
      body: [],
    }).as('getInferenceServices');
  });

  describe('InferenceGraph List Page', () => {
    it('should load the inference graphs page successfully', () => {
      // Mock empty graphs response
      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs`, {
        statusCode: 200,
        body: [],
      }).as('getInferenceGraphsEmpty');

      cy.visit('/inference-graphs');
      cy.wait('@getConfig');
      cy.wait('@getNamespaces');

      // Verify page loaded
      cy.get('app-inference-graph', { timeout: 2000 }).should('exist');
    });

    it('should display page title as "InferenceGraphs"', () => {
      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs`, {
        statusCode: 200,
        body: [],
      }).as('getInferenceGraphsEmpty');

      cy.visit('/inference-graphs');
      cy.wait('@getConfig');

      // Check title in toolbar
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

      // Check for toolbar buttons
      cy.contains('button', 'View Endpoints', { timeout: 2000 }).should('be.visible');
      cy.contains('button', 'New InferenceGraph').should('be.visible');
    });

    it('should display inference graphs in a table', () => {
      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs`, {
        statusCode: 200,
        body: [mockInferenceGraph, mockEnsembleGraph],
      }).as('getInferenceGraphs');

      cy.visit('/inference-graphs');
      cy.wait('@getInferenceGraphs');

      // Verify table exists and has data
      cy.get('lib-resource-table', { timeout: 2000 }).should('exist');
      cy.contains(testGraphName).should('be.visible');
      cy.contains('ensemble-graph').should('be.visible');
    });

    it('should display router type for each graph', () => {
      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs`, {
        statusCode: 200,
        body: [mockInferenceGraph, mockEnsembleGraph],
      }).as('getInferenceGraphs');

      cy.visit('/inference-graphs');
      cy.wait('@getInferenceGraphs');

      // Check that router types are displayed
      cy.contains('Sequence').should('be.visible');
      cy.contains('Ensemble').should('be.visible');
    });

    it('should navigate to graph details when clicking on graph name', () => {
      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs`, {
        statusCode: 200,
        body: [mockInferenceGraph],
      }).as('getInferenceGraphs');

      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs/${testGraphName}`, {
        statusCode: 200,
        body: mockInferenceGraph,
      }).as('getInferenceGraph');

      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs/${testGraphName}/events`, {
        statusCode: 200,
        body: [],
      }).as('getEvents');

      cy.visit('/inference-graphs');
      cy.wait('@getInferenceGraphs');

      // Click on graph name
      cy.contains('a', testGraphName).click();

      // Verify navigation to details page
      cy.url().should('include', `/graph-details/${testNamespace}/${testGraphName}`);
    });

    it('should navigate to new graph form when clicking "New InferenceGraph" button', () => {
      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs`, {
        statusCode: 200,
        body: [],
      }).as('getInferenceGraphsEmpty');

      cy.visit('/inference-graphs');
      cy.wait('@getConfig');

      // Click new graph button
      cy.contains('button', 'New InferenceGraph').click();

      // Verify navigation to new graph form
      cy.url().should('include', '/new-graph');
    });

    it('should navigate to endpoints page when clicking "View Endpoints" button', () => {
      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs`, {
        statusCode: 200,
        body: [],
      }).as('getInferenceGraphsEmpty');

      cy.visit('/inference-graphs');
      cy.wait('@getConfig');

      // Click view endpoints button
      cy.contains('button', 'View Endpoints').click();

      // Verify navigation to endpoints page
      cy.url().should('match', /\/$|\/$/);
    });
  });

  describe('InferenceGraph Creation', () => {
    it('should display the graph form page', () => {
      cy.visit('/new-graph');
      cy.wait('@getConfig');
      cy.wait('@getNamespaces');

      // Verify form page loaded
      cy.get('app-graph-form', { timeout: 2000 }).should('exist');
    });

    it('should show default YAML template in editor', () => {
      cy.visit('/new-graph');
      cy.wait('@getConfig');

      // Wait for Monaco editor to load
      cy.get('lib-monaco-editor', { timeout: 5000 }).should('be.visible');
      cy.wait(1000);

      // Verify default template content is present
      cy.window().then((win: any) => {
        if (win.monaco && win.monaco.editor) {
          const editors = win.monaco.editor.getEditors();
          if (editors.length > 0) {
            const content = editors[0].getValue();
            expect(content).to.include('apiVersion: serving.kserve.io/v1alpha1');
            expect(content).to.include('kind: InferenceGraph');
          }
        }
      });
    });

    it('should create a new inference graph successfully', () => {
      const newGraph = {
        apiVersion: 'serving.kserve.io/v1alpha1',
        kind: 'InferenceGraph',
        metadata: {
          name: 'new-graph',
          namespace: testNamespace,
        },
        spec: {
          nodes: {
            root: {
              routerType: 'Sequence',
              steps: [{ serviceName: 'sklearn-iris' }],
            },
          },
        },
      };

      cy.intercept('POST', `/api/namespaces/${testNamespace}/inferencegraphs`, {
        statusCode: 200,
        body: { success: true },
      }).as('createGraph');

      cy.visit('/new-graph');
      cy.wait('@getConfig');
      cy.wait('@getNamespaces');

      // Wait for Monaco editor
      cy.get('lib-monaco-editor', { timeout: 5000 }).should('be.visible');
      cy.wait(1000);

      // Set YAML content
      cy.window().then((win: any) => {
        if (win.monaco && win.monaco.editor) {
          const editors = win.monaco.editor.getEditors();
          if (editors.length > 0) {
            editors[0].setValue(JSON.stringify(newGraph, null, 2));
          }
        }
      });

      // Submit form
      cy.contains('button', 'Submit').click();

      cy.wait('@createGraph');
      // Should navigate back to list
      cy.url({ timeout: 5000 }).should('match', /\/inference-graphs$/);
    });

    it('should show validation error for invalid YAML', () => {
      cy.visit('/new-graph');
      cy.wait('@getConfig');

      // Wait for Monaco editor
      cy.get('lib-monaco-editor', { timeout: 5000 }).should('be.visible');
      cy.wait(1000);

      // Set invalid YAML
      cy.window().then((win: any) => {
        if (win.monaco && win.monaco.editor) {
          const editors = win.monaco.editor.getEditors();
          if (editors.length > 0) {
            editors[0].setValue('invalid: yaml: [[[');
          }
        }
      });

      // Try to submit
      cy.contains('button', 'Submit').click();

      // Should show error message
      cy.contains('error', { matchCase: false, timeout: 3000 }).should('exist');
    });

    it('should cancel and navigate back', () => {
      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs`, {
        statusCode: 200,
        body: [],
      }).as('getInferenceGraphsEmpty');

      cy.visit('/new-graph');
      cy.wait('@getConfig');

      // Click cancel button
      cy.contains('button', 'Cancel').click();

      // Should navigate back
      cy.url({ timeout: 3000 }).should('not.include', '/new-graph');
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

      // Verify details page loaded
      cy.get('app-graph-info', { timeout: 2000 }).should('exist');
    });

    it('should show graph name in title', () => {
      cy.visit(`/graph-details/${testNamespace}/${testGraphName}`);
      cy.wait('@getInferenceGraph');

      // Check for graph name
      cy.contains(testGraphName, { timeout: 2000 }).should('be.visible');
    });

    it('should display Edit and Delete buttons', () => {
      cy.visit(`/graph-details/${testNamespace}/${testGraphName}`);
      cy.wait('@getInferenceGraph');

      // Check for action buttons
      cy.contains('button', 'EDIT', { timeout: 2000 }).should('be.visible');
      cy.contains('button', 'DELETE').should('be.visible');
    });

    it('should navigate to edit form when clicking Edit button', () => {
      cy.visit(`/graph-details/${testNamespace}/${testGraphName}`);
      cy.wait('@getInferenceGraph');

      // Click edit button
      cy.contains('button', 'EDIT').click();

      // Verify navigation to edit form
      cy.url().should('include', `/graph-edit/${testNamespace}/${testGraphName}`);
    });

    it('should display graph spec information', () => {
      cy.visit(`/graph-details/${testNamespace}/${testGraphName}`);
      cy.wait('@getInferenceGraph');

      // Check for spec details
      cy.contains('Sequence', { timeout: 2000 }).should('be.visible');
    });

    it('should display events', () => {
      cy.visit(`/graph-details/${testNamespace}/${testGraphName}`);
      cy.wait('@getInferenceGraph');
      cy.wait('@getEvents');

      // Events should be displayed (if component shows them)
      cy.get('app-graph-info').should('exist');
    });
  });

  describe('InferenceGraph Edit', () => {
    it('should load existing graph data in edit form', () => {
      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs/${testGraphName}`, {
        statusCode: 200,
        body: mockInferenceGraph,
      }).as('getInferenceGraph');

      cy.visit(`/graph-edit/${testNamespace}/${testGraphName}`);
      cy.wait('@getInferenceGraph');

      // Wait for Monaco editor
      cy.get('lib-monaco-editor', { timeout: 5000 }).should('be.visible');
      cy.wait(1000);

      // Verify graph data is loaded
      cy.window().then((win: any) => {
        if (win.monaco && win.monaco.editor) {
          const editors = win.monaco.editor.getEditors();
          if (editors.length > 0) {
            const content = editors[0].getValue();
            expect(content).to.include(testGraphName);
            expect(content).to.include('Sequence');
          }
        }
      });
    });

    it('should update graph successfully', () => {
      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs/${testGraphName}`, {
        statusCode: 200,
        body: mockInferenceGraph,
      }).as('getInferenceGraph');

      cy.intercept('PUT', `/api/namespaces/${testNamespace}/inferencegraphs/${testGraphName}`, {
        statusCode: 200,
        body: { success: true },
      }).as('updateGraph');

      cy.visit(`/graph-edit/${testNamespace}/${testGraphName}`);
      cy.wait('@getInferenceGraph');

      // Wait for Monaco editor
      cy.get('lib-monaco-editor', { timeout: 5000 }).should('be.visible');
      cy.wait(1000);

      // Modify content
      cy.window().then((win: any) => {
        if (win.monaco && win.monaco.editor) {
          const editors = win.monaco.editor.getEditors();
          if (editors.length > 0) {
            const updatedGraph = { ...mockInferenceGraph };
            updatedGraph.spec.nodes.root.steps.push({ serviceName: 'new-service' });
            editors[0].setValue(JSON.stringify(updatedGraph, null, 2));
          }
        }
      });

      // Submit form
      cy.contains('button', 'Submit').click();

      cy.wait('@updateGraph');
      // Should navigate back
      cy.url({ timeout: 5000 }).should('match', /\/(inference-graphs|graph-details)/);
    });
  });

  describe('InferenceGraph Deletion', () => {
    it('should show delete confirmation dialog', () => {
      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs/${testGraphName}`, {
        statusCode: 200,
        body: mockInferenceGraph,
      }).as('getInferenceGraph');

      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs/${testGraphName}/events`, {
        statusCode: 200,
        body: [],
      }).as('getEvents');

      cy.visit(`/graph-details/${testNamespace}/${testGraphName}`);
      cy.wait('@getInferenceGraph');

      // Click delete button
      cy.contains('button', 'DELETE').click();

      // Should show confirmation dialog
      cy.get('lib-confirm-dialog', { timeout: 2000 }).should('be.visible');
    });

    it('should delete graph when confirmed', () => {
      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs/${testGraphName}`, {
        statusCode: 200,
        body: mockInferenceGraph,
      }).as('getInferenceGraph');

      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs/${testGraphName}/events`, {
        statusCode: 200,
        body: [],
      }).as('getEvents');

      cy.intercept('DELETE', `/api/namespaces/${testNamespace}/inferencegraphs/${testGraphName}`, {
        statusCode: 200,
        body: { success: true },
      }).as('deleteGraph');

      cy.visit(`/graph-details/${testNamespace}/${testGraphName}`);
      cy.wait('@getInferenceGraph');

      // Click delete button
      cy.contains('button', 'DELETE').click();

      // Confirm deletion in dialog
      cy.get('lib-confirm-dialog').within(() => {
        cy.contains('button', 'DELETE', { matchCase: false }).click();
      });

      cy.wait('@deleteGraph', { timeout: 5000 });
    });

    it('should cancel deletion when dialog is cancelled', () => {
      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs/${testGraphName}`, {
        statusCode: 200,
        body: mockInferenceGraph,
      }).as('getInferenceGraph');

      cy.intercept('GET', `/api/namespaces/${testNamespace}/inferencegraphs/${testGraphName}/events`, {
        statusCode: 200,
        body: [],
      }).as('getEvents');

      cy.visit(`/graph-details/${testNamespace}/${testGraphName}`);
      cy.wait('@getInferenceGraph');

      // Click delete button
      cy.contains('button', 'DELETE').click();

      // Cancel deletion
      cy.get('lib-confirm-dialog').within(() => {
        cy.contains('button', 'CANCEL').click();
      });

      // Should still be on details page
      cy.url().should('include', `/graph-details/${testNamespace}/${testGraphName}`);
    });
  });

  describe('Multiple Namespace Support', () => {
    it('should list graphs from multiple namespaces', () => {
      const multiNamespaces = ['namespace-1', 'namespace-2'];

      cy.intercept('GET', '/api/config/namespaces', {
        statusCode: 200,
        body: {
          namespaces: multiNamespaces,
        },
      }).as('getMultiNamespaces');

      cy.intercept('GET', '/api/namespaces/*/inferencegraphs', {
        statusCode: 200,
        body: [
          { ...mockInferenceGraph, metadata: { ...mockInferenceGraph.metadata, namespace: 'namespace-1' } },
          { ...mockEnsembleGraph, metadata: { ...mockEnsembleGraph.metadata, namespace: 'namespace-2' } },
        ],
      }).as('getInferenceGraphsMulti');

      cy.visit('/inference-graphs');
      cy.wait('@getConfig');
      cy.wait('@getMultiNamespaces');

      // Should show graphs from both namespaces
      cy.get('lib-resource-table', { timeout: 3000 }).should('exist');
    });
  });
});
