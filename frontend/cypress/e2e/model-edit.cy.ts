describe('Models Web App - Model Edit Tests', () => {
  const testModel = {
    metadata: {
      name: 'test-sklearn-model',
      namespace: 'kubeflow-user',
      creationTimestamp: '2024-01-15T10:30:00Z',
      resourceVersion: '12345',
      uid: 'test-uid-123',
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
      components: {
        predictor: {
          latestCreatedRevision: 'test-sklearn-model-predictor-00001',
        },
      },
    },
  };

  beforeEach(() => {
    // Mock namespaces API
    cy.intercept('GET', '/api/config/namespaces', {
      statusCode: 200,
      body: {
        namespaces: ['kubeflow-user'],
      },
    }).as('getNamespaces');

    // Mock specific inference service details (wrapped in MWABackendResponse)
    cy.intercept(
      'GET',
      '/api/namespaces/kubeflow-user/inferenceservices/test-sklearn-model',
      {
        statusCode: 200,
        body: {
          inferenceService: testModel,
        },
      },
    ).as('getInferenceService');

    // Mock Knative owned objects (required for details page, wrapped in MWABackendResponse)
    cy.intercept(
      'GET',
      '/api/namespaces/kubeflow-user/revisions/test-sklearn-model-predictor-00001',
      {
        statusCode: 200,
        body: {
          knativeRevision: {
            metadata: {
              name: 'test-sklearn-model-predictor-00001',
              ownerReferences: [{ name: 'test-sklearn-model-predictor' }],
            },
          },
        },
      },
    ).as('getRevision');

    cy.intercept(
      'GET',
      '/api/namespaces/kubeflow-user/configurations/test-sklearn-model-predictor',
      {
        statusCode: 200,
        body: {
          knativeConfiguration: {
            metadata: {
              name: 'test-sklearn-model-predictor',
              ownerReferences: [{ name: 'test-sklearn-model-predictor' }],
            },
          },
        },
      },
    ).as('getConfiguration');

    cy.intercept(
      'GET',
      '/api/namespaces/kubeflow-user/knativeServices/test-sklearn-model-predictor',
      {
        statusCode: 200,
        body: {
          knativeService: {
            metadata: {
              name: 'test-sklearn-model-predictor',
            },
          },
        },
      },
    ).as('getKnativeService');

    cy.intercept(
      'GET',
      '/api/namespaces/kubeflow-user/routes/test-sklearn-model-predictor',
      {
        statusCode: 200,
        body: {
          knativeRoute: {
            metadata: {
              name: 'test-sklearn-model-predictor',
            },
          },
        },
      },
    ).as('getRoute');

    // Mock Grafana API (optional - for metrics tab)
    cy.intercept('GET', '/grafana/api/search', {
      statusCode: 404,
    }).as('getGrafana');

    // Navigate to model details page
    cy.visit('/details/kubeflow-user/test-sklearn-model');
  });

  it('should load model details page and show edit button', () => {
    // Wait for all API calls to complete (required for serverInfoLoaded = true)
    cy.wait('@getInferenceService');
    cy.wait('@getRevision');
    cy.wait('@getConfiguration');
    cy.wait('@getKnativeService');
    cy.wait('@getRoute');

    // Verify page elements are loaded
    cy.get('lib-title-actions-toolbar', { timeout: 10000 }).should('exist');
    cy.contains('Endpoint details').should('be.visible');
    cy.contains('test-sklearn-model').should('be.visible');

    // Wait for tabs to appear (indicates serverInfoLoaded = true) - check for tab content
    cy.get('mat-tab-group', { timeout: 15000 }).should('be.visible');

    // Verify specific tabs exist by looking for their text content
    cy.contains('OVERVIEW', { timeout: 10000 }).should('be.visible');
    cy.contains('DETAILS').should('be.visible');

    // Verify EDIT button exists (should be available after full load)
    cy.get('lib-title-actions-toolbar').within(() => {
      cy.get('button').contains('EDIT').should('be.visible');
    });
  });

  it('should enter edit mode when EDIT button is clicked', () => {
    // Wait for complete page load
    cy.wait('@getInferenceService');
    cy.wait('@getRevision');
    cy.wait('@getConfiguration');
    cy.wait('@getKnativeService');
    cy.wait('@getRoute');

    // Click EDIT button
    cy.get('lib-title-actions-toolbar').within(() => {
      cy.get('button').contains('EDIT').click();
    });

    // Verify edit mode is active
    cy.get('app-edit').should('be.visible');

    // Verify tabs are hidden in edit mode
    cy.get('mat-tab-group').should('not.exist');

    // Verify ACE editor is loaded (it may take time to initialize)
    cy.get('app-edit').within(() => {
      cy.get('.ace_editor', { timeout: 10000 }).should('be.visible');
    });
  });

  it('should display YAML content in editor', () => {
    // Wait for complete page load
    cy.wait('@getInferenceService');
    cy.wait('@getRevision');
    cy.wait('@getConfiguration');
    cy.wait('@getKnativeService');
    cy.wait('@getRoute');

    // Enter edit mode
    cy.get('lib-title-actions-toolbar').within(() => {
      cy.get('button').contains('EDIT').click();
    });

    // Wait for ACE editor to load
    cy.get('.ace_editor', { timeout: 10000 }).should('be.visible');

    // Verify YAML content is displayed (check for key elements)
    cy.get('.ace_editor').within(() => {
      cy.contains('predictor').should('be.visible');
      cy.contains('sklearn').should('be.visible');
      cy.contains('gs://test-bucket/sklearn-model').should('be.visible');
    });
  });

  it('should successfully submit edited model', () => {
    // Mock successful update - backend returns simple success message
    cy.intercept(
      'PUT',
      '/api/namespaces/kubeflow-user/inferenceservices/test-sklearn-model',
      {
        statusCode: 200,
        body: {
          success: true,
          message: 'InferenceService successfully updated',
        },
      },
    ).as('updateInferenceService');

    // Wait for page to load completely
    cy.wait('@getInferenceService');
    cy.wait('@getRevision');
    cy.wait('@getConfiguration');
    cy.wait('@getKnativeService');
    cy.wait('@getRoute');

    // Enter edit mode
    cy.get('lib-title-actions-toolbar').within(() => {
      cy.get('button').contains('EDIT').click();
    });

    // Wait for ACE editor to load
    cy.get('.ace_editor', { timeout: 10000 }).should('be.visible');

    // Edit the YAML content
    cy.window().then((win: any) => {
      // Get the ACE editor instance and modify content
      const aceEditor = win.ace.edit(Cypress.$('.ace_editor')[0]);
      const currentValue = aceEditor.getValue();
      const updatedValue = currentValue
        .replace(
          'gs://test-bucket/sklearn-model',
          'gs://test-bucket/updated-sklearn-model',
        )
        .replace('runtimeVersion: "0.24.1"', 'runtimeVersion: "0.24.2"');
      aceEditor.setValue(updatedValue);
      aceEditor.clearSelection();
    });

    // Submit the changes
    cy.get('app-edit').within(() => {
      cy.get('button').contains('Submit').click();
    });

    // Verify API call was made
    cy.wait('@updateInferenceService');

    // Verify success notification
    cy.get('.mat-snack-bar-container', { timeout: 5000 })
      .should('be.visible')
      .and('contain', 'successfully updated');

    // Verify edit mode is exited
    cy.get('app-edit').should('not.exist');

    // After edit completion, the component should return to details view
    // The tabs should be visible again
    cy.get('mat-tab-group', { timeout: 10000 }).should('be.visible');
  });

  it('should cancel edit when cancel button is clicked', () => {
    // Wait for complete page load
    cy.wait('@getInferenceService');
    cy.wait('@getRevision');
    cy.wait('@getConfiguration');
    cy.wait('@getKnativeService');
    cy.wait('@getRoute');

    // Enter edit mode
    cy.get('lib-title-actions-toolbar').within(() => {
      cy.get('button').contains('EDIT').click();
    });

    // Verify edit mode is active
    cy.get('app-edit').should('be.visible');

    // Click cancel button
    cy.get('app-edit').within(() => {
      cy.get('button').contains('Cancel').click();
    });

    // Verify edit mode is exited
    cy.get('app-edit').should('not.exist');

    // Wait for tabs to appear after cancel - may take time
    cy.get('mat-tab-group', { timeout: 10000 }).should('be.visible');
  });

  it('should handle edit submission errors gracefully', () => {
    // Mock failed update (wrapped in MWABackendResponse error format)
    cy.intercept(
      'PUT',
      '/api/namespaces/kubeflow-user/inferenceservices/test-sklearn-model',
      {
        statusCode: 500,
        body: {
          success: false,
          error: 'Internal server error during update',
        },
      },
    ).as('updateInferenceServiceError');

    // Wait for complete page load
    cy.wait('@getInferenceService');
    cy.wait('@getRevision');
    cy.wait('@getConfiguration');
    cy.wait('@getKnativeService');
    cy.wait('@getRoute');

    // Enter edit mode
    cy.get('lib-title-actions-toolbar').within(() => {
      cy.get('button').contains('EDIT').click();
    });

    // Wait for ACE editor to load
    cy.get('.ace_editor', { timeout: 10000 }).should('be.visible');

    // Submit without changes (just to test error handling)
    cy.get('app-edit').within(() => {
      cy.get('button').contains('Submit').click();
    });

    // Wait for failed API call
    cy.wait('@updateInferenceServiceError');

    // Verify error notification
    cy.get('.mat-snack-bar-container', { timeout: 5000 })
      .should('be.visible')
      .and('contain', 'Failed to update');

    // Verify edit mode is still active (user can retry)
    cy.get('app-edit').should('be.visible');
  });

  it('should handle invalid YAML gracefully', () => {
    // Wait for complete page load
    cy.wait('@getInferenceService');
    cy.wait('@getRevision');
    cy.wait('@getConfiguration');
    cy.wait('@getKnativeService');
    cy.wait('@getRoute');

    // Enter edit mode
    cy.get('lib-title-actions-toolbar').within(() => {
      cy.get('button').contains('EDIT').click();
    });

    // Wait for ACE editor to load
    cy.get('.ace_editor', { timeout: 10000 }).should('be.visible');

    // Set invalid YAML content
    cy.window().then((win: any) => {
      const aceEditor = win.ace.edit(Cypress.$('.ace_editor')[0]);
      aceEditor.setValue('invalid: yaml: content: [unclosed');
      aceEditor.clearSelection();
    });

    // Try to submit invalid YAML
    cy.get('app-edit').within(() => {
      cy.get('button').contains('Submit').click();
    });

    // Verify that submission is handled (either prevented or shows error)
    // The component should handle YAML parsing errors client-side
    cy.get('app-edit').should('be.visible'); // Should remain in edit mode
  });

  it('should allow navigation back from details page', () => {
    // Wait for page to load
    cy.wait('@getInferenceService');

    // Click back button
    cy.get('lib-title-actions-toolbar button[mat-icon-button]').first().click();

    // Verify navigation back to index
    cy.url().should('not.include', '/details');
    cy.get('app-index').should('exist');
  });
});
