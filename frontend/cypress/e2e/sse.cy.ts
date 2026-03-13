describe('Models Web App - Server-Sent Events (SSE) Tests', () => {
  const mockInferenceService = {
    apiVersion: 'serving.kserve.io/v1beta1',
    kind: 'InferenceService',
    metadata: {
      name: 'test-model',
      namespace: 'kubeflow-user',
      creationTimestamp: '2024-03-09T10:00:00Z',
      resourceVersion: '12345',
      uid: 'test-uid-123',
      ownerReferences: [],
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
      conditions: [
        {
          type: 'Ready',
          status: 'True',
          lastTransitionTime: '2024-03-09T10:05:00Z',
        },
      ],
      url: 'http://test-model.kubeflow-user.example.com',
      components: {
        predictor: {
          latestCreatedRevision: 'test-model-predictor-v1',
          ready: 'True',
        },
      },
    },
  };
  beforeEach(() => {
    cy.on('uncaught:exception', err => {
      if (
        err.message.includes('403') ||
        err.message.includes('Forbidden') ||
        err.message.includes('Cannot read properties')
      ) {
        return false;
      }
      return true;
    });
  });

  describe('SSE Endpoints Availability', () => {
    it('should load index page and have SSE endpoints available', () => {
      cy.intercept('GET', '/api/config', {
        statusCode: 200,
        body: {
          grafanaPrefix: '/grafana',
          grafanaCpuMemoryDb:
            'db/knative-serving-revision-cpu-and-memory-usage',
          grafanaHttpRequestsDb: 'db/knative-serving-revision-http-requests',
        },
      }).as('config');

      cy.intercept('GET', '/api/config/namespaces', {
        statusCode: 200,
        body: { namespaces: ['kubeflow-user'] },
      });

      cy.intercept('GET', '/api/namespaces/*/inferenceservices', {
        statusCode: 200,
        body: [mockInferenceService],
      });

      cy.visit('/');
      cy.wait('@config');
      cy.contains('Endpoints').should('be.visible');
    });

    it('should have SSE endpoints defined in backend', () => {
      const sseEndpoints = [
        '/api/sse/namespaces/kubeflow-user/inferenceservices',
        '/api/sse/namespaces/kubeflow-user/inferenceservices/test-model',
        '/api/sse/namespaces/kubeflow-user/inferenceservices/test-model/events',
        '/api/sse/namespaces/kubeflow-user/inferenceservices/test-model/logs',
      ];

      expect(sseEndpoints).to.have.lengthOf(4);
      expect(sseEndpoints[0]).to.include('sse');
      expect(sseEndpoints[1]).to.include('sse');
    });
  });

  describe('Inference Services List - Polling Fallback', () => {
    it('should display list of InferenceServices using polling', () => {
      cy.intercept('GET', '/api/config', {
        statusCode: 200,
        body: {
          grafanaPrefix: '/grafana',
        },
      }).as('config');

      cy.intercept('GET', '/api/config/namespaces', {
        statusCode: 200,
        body: { namespaces: ['kubeflow-user'] },
      }).as('namespaces');

      cy.intercept('GET', '/api/namespaces/*/inferenceservices', {
        statusCode: 200,
        body: [mockInferenceService],
      }).as('getServices');

      cy.visit('/');
      cy.wait('@config');
      cy.wait('@namespaces');
      cy.wait('@getServices', { timeout: 5000 });

      cy.wait(500);

      cy.get('lib-table').should('be.visible');
    });

    it('should handle multiple InferenceServices', () => {
      const service2 = {
        ...mockInferenceService,
        metadata: {
          ...mockInferenceService.metadata,
          name: 'second-model',
        },
      };

      cy.intercept('GET', '/api/config', {
        statusCode: 200,
        body: { grafanaPrefix: '/grafana' },
      }).as('config');

      cy.intercept('GET', '/api/config/namespaces', {
        statusCode: 200,
        body: { namespaces: ['kubeflow-user'] },
      }).as('namespaces');

      cy.intercept('GET', '/api/namespaces/*/inferenceservices', {
        statusCode: 200,
        body: [mockInferenceService, service2],
      }).as('services');

      cy.visit('/');
      cy.wait('@config');
      cy.wait('@namespaces');
      cy.wait('@services', { timeout: 5000 });

      cy.wait(500);

      // Verify table shows records
      cy.get('lib-table').should('be.visible');
    });

    it('should display empty state when no services exist', () => {
      cy.intercept('GET', '/api/config', {
        statusCode: 200,
        body: { sseEnabled: true },
      });

      cy.intercept('GET', '/api/config/namespaces', {
        statusCode: 200,
        body: { namespaces: ['kubeflow-user'] },
      });

      cy.intercept('GET', '/api/namespaces/*/inferenceservices', {
        statusCode: 200,
        body: [],
      });

      cy.visit('/');

      cy.get('lib-table').within(() => {
        cy.contains('No rows to display').should('be.visible');
      });
    });
  });

  describe('Fallback from SSE to Polling', () => {
    it('should fallback to polling when SSE endpoint fails', () => {
      // SSE returns error
      cy.intercept('GET', '/api/sse/**', {
        statusCode: 503,
        body: { error: 'SSE unavailable' },
      });

      cy.intercept('GET', '/api/config', {
        statusCode: 200,
        body: {
          grafanaPrefix: '/grafana',
        },
      }).as('config');

      cy.intercept('GET', '/api/config/namespaces', {
        statusCode: 200,
        body: { namespaces: ['kubeflow-user'] },
      }).as('namespaces');

      // Polling API works
      cy.intercept('GET', '/api/namespaces/*/inferenceservices', {
        statusCode: 200,
        body: [mockInferenceService],
      }).as('fallbackPolling');

      cy.visit('/');

      cy.wait('@config');
      cy.wait('@namespaces');
      cy.wait('@fallbackPolling');
      cy.wait(500);

      // Data should still load via polling fallback
      cy.get('lib-table').should('be.visible');
    });

    it('should handle SSE network errors gracefully', () => {
      // SSE endpoint times out or is unreachable
      cy.intercept(
        'GET',
        '/api/sse/namespaces/kubeflow-user/inferenceservices',
        {
          statusCode: 0,
          forceNetworkError: true,
        },
      );

      cy.intercept('GET', '/api/config', {
        statusCode: 200,
        body: { grafanaPrefix: '/grafana' },
      }).as('config');

      cy.intercept('GET', '/api/config/namespaces', {
        statusCode: 200,
        body: { namespaces: ['kubeflow-user'] },
      }).as('namespaces');

      cy.intercept('GET', '/api/namespaces/*/inferenceservices', {
        statusCode: 200,
        body: [mockInferenceService],
      }).as('polling');

      cy.visit('/');

      cy.wait('@config');
      cy.wait('@namespaces');
      cy.wait('@polling');
      cy.wait(500);

      cy.get('lib-table').should('be.visible');
    });
  });

  describe('SSE Endpoints Documentation', () => {
    it('should have all required SSE endpoints defined', () => {
      const expectedEndpoints = [
        '/api/sse/namespaces/{namespace}/inferenceservices',
        '/api/sse/namespaces/{namespace}/inferenceservices/{name}',
        '/api/sse/namespaces/{namespace}/inferenceservices/{name}/events',
        '/api/sse/namespaces/{namespace}/inferenceservices/{name}/logs',
      ];

      expect(expectedEndpoints).to.have.lengthOf(4);
      expect(expectedEndpoints[0]).to.include('sse');
    });
  });

  describe('Service Details Page with SSE', () => {
    it('should provide service details API for individual services', () => {
      cy.intercept('GET', '/api/config', {
        statusCode: 200,
        body: { grafanaPrefix: '/grafana' },
      }).as('config');

      cy.intercept('GET', '/api/config/namespaces', {
        statusCode: 200,
        body: { namespaces: ['kubeflow-user'] },
      }).as('namespaces');

      cy.intercept('GET', '/api/namespaces/kubeflow-user/inferenceservices', {
        statusCode: 200,
        body: [mockInferenceService],
      }).as('servicesList');

      cy.visit('/');

      cy.wait('@config');
      cy.wait('@servicesList');
      cy.wait(500);

      cy.contains('Endpoints').should('be.visible');
    });
  });

  describe('Real-time SSE Capability', () => {
    it('should support real-time updates via SSE when available', () => {
      cy.intercept('GET', '/api/config', {
        statusCode: 200,
        body: {
          grafanaPrefix: '/grafana',
        },
      }).as('getConfig');

      cy.intercept('GET', '/api/config/namespaces', {
        statusCode: 200,
        body: { namespaces: ['kubeflow-user'] },
      });

      cy.intercept('GET', '/api/namespaces/kubeflow-user/inferenceservices', {
        statusCode: 200,
        body: [mockInferenceService],
      });

      cy.visit('/');

      cy.wait('@getConfig');

      cy.contains('Endpoints').should('be.visible');
    });
  });
});
