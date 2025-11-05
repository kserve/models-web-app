describe('Models Web App - Namespace Configuration Tests', () => {
  beforeEach(() => {
    // Mock the app configuration API
    cy.intercept('GET', '/api/config', {
      statusCode: 200,
      body: {
        grafanaPrefix: '/grafana',
        grafanaCpuMemoryDb: 'db/knative-serving-revision-cpu-and-memory-usage',
        grafanaHttpRequestsDb: 'db/knative-serving-revision-http-requests',
      },
    }).as('getConfig');

    // Default empty response for inference services
    cy.intercept('GET', '/api/namespaces/*/inferenceservices', {
      statusCode: 200,
      body: [],
    }).as('getInferenceServices');
  });

  describe('Default Behavior (All Namespaces)', () => {
    beforeEach(() => {
      // Mock namespace API returning all available namespaces
      cy.intercept('GET', '/api/config/namespaces', {
        statusCode: 200,
        body: {
          namespaces: [
            'default',
            'kube-system',
            'kubeflow-user',
            'test-ns-1',
            'test-ns-2',
          ],
          status: 200,
          success: true,
        },
      }).as('getAllNamespaces');

      cy.visit('/');
      cy.wait('@getConfig');
      cy.wait('@getAllNamespaces');
    });

    it('should display namespace dropdown with all available namespaces', () => {
      cy.get('app-namespace-select', { timeout: 5000 }).should('exist');
      cy.get('app-namespace-select').within(() => {
        // Should show dropdown selector (not single namespace display)
        cy.get('.namespace-selector').should('exist');
        cy.get('.single-namespace-display').should('not.exist');

        // Open dropdown and verify all namespaces are present
        cy.get('mat-select').click();
      });

      // Verify all namespaces appear in dropdown
      cy.get('mat-option').should('have.length', 5);
      cy.get('mat-option').contains('default').should('exist');
      cy.get('mat-option').contains('kube-system').should('exist');
      cy.get('mat-option').contains('kubeflow-user').should('exist');
      cy.get('mat-option').contains('test-ns-1').should('exist');
      cy.get('mat-option').contains('test-ns-2').should('exist');
    });

    it('should allow user to select different namespaces', () => {
      cy.get('app-namespace-select').within(() => {
        cy.get('mat-select').click();
      });

      // Select a namespace
      cy.get('mat-option').contains('kubeflow-user').click();

      // Verify selection is updated
      cy.get('app-namespace-select').within(() => {
        cy.get('mat-select').should('contain', 'kubeflow-user');
      });
    });
  });

  describe('Single Namespace Mode', () => {
    beforeEach(() => {
      // Mock namespace API returning only one namespace
      cy.intercept('GET', '/api/config/namespaces', {
        statusCode: 200,
        body: {
          namespaces: ['kubeflow-user'],
          status: 200,
          success: true,
        },
      }).as('getSingleNamespace');

      cy.visit('/');
      cy.wait('@getConfig');
      cy.wait('@getSingleNamespace');
    });

    it('should display namespace as static text instead of dropdown', () => {
      cy.get('app-namespace-select', { timeout: 5000 }).should('exist');
      cy.get('app-namespace-select').within(() => {
        // Should show single namespace display (not dropdown)
        cy.get('.single-namespace-display').should('exist');
        cy.get('.namespace-selector').should('not.exist');

        // Verify namespace is displayed as static text
        cy.get('.namespace-value').should('contain', 'kubeflow-user');
        cy.get('.namespace-label').should('contain', 'Namespace:');
        cy.get('.namespace-icon').should('exist');
      });
    });

    it('should not allow namespace selection in single namespace mode', () => {
      cy.get('app-namespace-select').within(() => {
        // No dropdown should exist
        cy.get('mat-select').should('not.exist');
        cy.get('mat-option').should('not.exist');
      });
    });

    it('should auto-select the single available namespace', () => {
      // Verify that the namespace is automatically selected
      cy.get('app-namespace-select').within(() => {
        cy.get('.namespace-value').should('contain', 'kubeflow-user');
      });

      // The inference services API should be called with the auto-selected namespace
      cy.wait('@getInferenceServices');
    });
  });

  describe('Multiple Namespaces Mode', () => {
    beforeEach(() => {
      // Mock namespace API returning multiple filtered namespaces
      cy.intercept('GET', '/api/config/namespaces', {
        statusCode: 200,
        body: {
          namespaces: ['kubeflow-user', 'test-ns-1', 'test-ns-2'],
          status: 200,
          success: true,
        },
      }).as('getMultipleNamespaces');

      cy.visit('/');
      cy.wait('@getConfig');
      cy.wait('@getMultipleNamespaces');
    });

    it('should display dropdown with only filtered namespaces', () => {
      cy.get('app-namespace-select', { timeout: 5000 }).should('exist');
      cy.get('app-namespace-select').within(() => {
        // Should show dropdown selector
        cy.get('.namespace-selector').should('exist');
        cy.get('.single-namespace-display').should('not.exist');

        // Open dropdown
        cy.get('mat-select').click();
      });

      // Verify only filtered namespaces appear
      cy.get('mat-option').should('have.length', 3);
      cy.get('mat-option').contains('kubeflow-user').should('exist');
      cy.get('mat-option').contains('test-ns-1').should('exist');
      cy.get('mat-option').contains('test-ns-2').should('exist');

      // Verify excluded namespaces don't appear
      cy.get('mat-option').contains('default').should('not.exist');
      cy.get('mat-option').contains('kube-system').should('not.exist');
    });

    it('should handle namespace selection in filtered mode', () => {
      cy.get('app-namespace-select').within(() => {
        cy.get('mat-select').click();
      });

      // Select a filtered namespace
      cy.get('mat-option').contains('test-ns-1').click();

      // Verify selection
      cy.get('app-namespace-select').within(() => {
        cy.get('mat-select').should('contain', 'test-ns-1');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle namespace API errors gracefully', () => {
      // Mock API error
      cy.intercept('GET', '/api/config/namespaces', {
        statusCode: 500,
        body: {
          message: 'Failed to retrieve namespaces',
          status: 500,
          success: false,
        },
      }).as('getNamespacesError');

      cy.visit('/');
      cy.wait('@getConfig');
      cy.wait('@getNamespacesError');

      // Should still render the page without crashing
      cy.get('app-root').should('exist');
      cy.get('app-index').should('exist');

      // Namespace selector might not be visible or show error state
      cy.get('app-namespace-select').should('exist');
    });

    it('should handle empty namespace response', () => {
      // Mock empty namespace response
      cy.intercept('GET', '/api/config/namespaces', {
        statusCode: 200,
        body: {
          namespaces: [],
          status: 200,
          success: true,
        },
      }).as('getEmptyNamespaces');

      cy.visit('/');
      cy.wait('@getConfig');
      cy.wait('@getEmptyNamespaces');

      // Should handle empty namespace list gracefully
      cy.get('app-namespace-select').should('exist');
    });
  });

  describe('Responsive Design', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/config/namespaces', {
        statusCode: 200,
        body: {
          namespaces: ['kubeflow-user', 'test-ns-1'],
          status: 200,
          success: true,
        },
      }).as('getNamespaces');

      cy.visit('/');
      cy.wait('@getConfig');
      cy.wait('@getNamespaces');
    });

    it('should display correctly on mobile viewport', () => {
      cy.viewport(375, 667); // iPhone SE

      cy.get('app-namespace-select').should('exist');
      cy.get('app-namespace-select').within(() => {
        cy.get('.namespace-selector').should('exist');
        // Should still be functional on mobile
        cy.get('mat-select').should('be.visible');
      });
    });

    it('should display correctly on tablet viewport', () => {
      cy.viewport(768, 1024); // iPad

      cy.get('app-namespace-select').should('exist');
      cy.get('app-namespace-select').within(() => {
        cy.get('.namespace-selector').should('exist');
        cy.get('mat-select').should('be.visible');
      });
    });

    it('should display correctly on desktop viewport', () => {
      cy.viewport(1920, 1080); // Desktop

      cy.get('app-namespace-select').should('exist');
      cy.get('app-namespace-select').within(() => {
        cy.get('.namespace-selector').should('exist');
        cy.get('mat-select').should('be.visible');
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/config/namespaces', {
        statusCode: 200,
        body: {
          namespaces: ['kubeflow-user', 'test-ns-1', 'test-ns-2'],
          status: 200,
          success: true,
        },
      }).as('getNamespaces');

      cy.visit('/');
      cy.wait('@getConfig');
      cy.wait('@getNamespaces');
    });

    it('should be keyboard navigable', () => {
      // Focus on namespace selector
      cy.get('app-namespace-select').within(() => {
        cy.get('mat-select').focus().should('be.focused');

        // Open dropdown with keyboard
        cy.focused().type('{enter}');
      });

      // Navigate through options with arrow keys
      cy.get('mat-option').first().should('be.focused');
      cy.focused().type('{downarrow}');
      cy.get('mat-option').eq(1).should('be.focused');

      // Select with Enter
      cy.focused().type('{enter}');
    });

    it('should have proper ARIA labels', () => {
      cy.get('app-namespace-select').within(() => {
        cy.get('mat-select').should('have.attr', 'aria-label');
        cy.get('mat-form-field mat-label').should('contain', 'Namespace');
      });
    });

    it('should support screen readers in single namespace mode', () => {
      // Test single namespace mode accessibility
      cy.intercept('GET', '/api/config/namespaces', {
        statusCode: 200,
        body: {
          namespaces: ['kubeflow-user'],
          status: 200,
          success: true,
        },
      }).as('getSingleNamespace');

      cy.reload();
      cy.wait('@getConfig');
      cy.wait('@getSingleNamespace');

      cy.get('app-namespace-select').within(() => {
        cy.get('.single-namespace-display').should('exist');
        cy.get('.namespace-label').should('be.visible');
        cy.get('.namespace-value').should('be.visible');
      });
    });
  });

  describe('Integration with Main App', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/config/namespaces', {
        statusCode: 200,
        body: {
          namespaces: ['kubeflow-user', 'test-ns-1'],
          status: 200,
          success: true,
        },
      }).as('getNamespaces');

      cy.visit('/');
      cy.wait('@getConfig');
      cy.wait('@getNamespaces');
    });

    it('should trigger inference services refresh when namespace changes', () => {
      // Initially, wait for default namespace call
      cy.wait('@getInferenceServices');

      // Intercept specific namespace calls
      cy.intercept('GET', '/api/namespaces/kubeflow-user/inferenceservices', {
        statusCode: 200,
        body: [
          {
            metadata: {
              name: 'test-model',
              namespace: 'kubeflow-user',
              creationTimestamp: '2024-01-01T00:00:00Z',
            },
            spec: {
              predictor: { sklearn: { storageUri: 's3://bucket/model' } },
            },
            status: { url: 'http://test-model.example.com' },
          },
        ],
      }).as('getKubeflowUserServices');

      cy.intercept('GET', '/api/namespaces/test-ns-1/inferenceservices', {
        statusCode: 200,
        body: [],
      }).as('getTestNs1Services');

      // Change namespace
      cy.get('app-namespace-select').within(() => {
        cy.get('mat-select').click();
      });
      cy.get('mat-option').contains('kubeflow-user').click();

      // Should trigger new API call for selected namespace
      cy.wait('@getKubeflowUserServices');

      // Verify the table updates with new data
      cy.get('lib-table').within(() => {
        cy.contains('test-model').should('be.visible');
      });

      // Change to different namespace
      cy.get('app-namespace-select').within(() => {
        cy.get('mat-select').click();
      });
      cy.get('mat-option').contains('test-ns-1').click();

      cy.wait('@getTestNs1Services');

      // Should show empty state for namespace with no services
      cy.get('lib-table').within(() => {
        cy.contains('No rows to display').should('be.visible');
      });
    });

    it('should update "New Endpoint" button namespace context', () => {
      // Select a specific namespace
      cy.get('app-namespace-select').within(() => {
        cy.get('mat-select').click();
      });
      cy.get('mat-option').contains('test-ns-1').click();

      // Click new endpoint button
      cy.contains('button', 'New Endpoint').click();
      cy.url().should('include', '/new');

      // The form should have the selected namespace context
      // (This would need to be verified based on the actual form implementation)
      cy.get('app-submit-form').should('exist');
    });
  });
});
