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

  /** Wait for all the backend calls that must complete before the page is interactive */
  const waitForPageLoad = () => {
    cy.wait('@getInferenceService');
    cy.wait('@getRevision');
    cy.wait('@getConfiguration');
    cy.wait('@getKnativeService');
    cy.wait('@getRoute');
  };

  it('should load model details page and show edit button', () => {
    waitForPageLoad();

    // Verify page elements are loaded
    cy.get('lib-title-actions-toolbar', { timeout: 10000 }).should('exist');
    cy.contains('Endpoint details').should('be.visible');
    cy.contains('test-sklearn-model').should('be.visible');

    // Wait for tabs to appear (indicates serverInfoLoaded = true)
    cy.get('mat-tab-group', { timeout: 15000 }).should('be.visible');

    // Verify specific tabs exist
    cy.contains('OVERVIEW', { timeout: 10000 }).should('be.visible');
    cy.contains('DETAILS').should('be.visible');

    // Verify EDIT button exists
    cy.get('lib-title-actions-toolbar').within(() => {
      cy.get('button').contains('EDIT').should('be.visible');
    });
  });

  it('should enter edit mode when EDIT button is clicked', () => {
    waitForPageLoad();

    // Click EDIT button
    cy.get('lib-title-actions-toolbar').within(() => {
      cy.get('button').contains('EDIT').click();
    });

    // Verify edit mode is active — form should be visible
    cy.get('app-edit', { timeout: 5000 }).should('be.visible');

    // Verify tabs are hidden in edit mode
    cy.get('mat-tab-group').should('not.exist');

    // Verify the structured form is loaded (not ACE editor)
    cy.get('app-edit').within(() => {
      cy.get('form.edit-form').should('exist');
      cy.contains('h3', 'Model Info').should('be.visible');
      cy.contains('h3', 'Scaling').should('be.visible');
      cy.contains('h3', 'Resource Allocation').should('be.visible');
    });
  });

  it('should display pre-populated form fields from inference service', () => {
    waitForPageLoad();

    // Enter edit mode
    cy.get('lib-title-actions-toolbar').within(() => {
      cy.get('button').contains('EDIT').click();
    });

    // Wait for edit form
    cy.get('app-edit form.edit-form', { timeout: 10000 }).should('be.visible');

    // Verify form fields are pre-populated from the test model
    cy.get('app-edit').within(() => {
      // Model name should be read-only and pre-filled
      cy.get('input[formControlName="modelName"]')
        .should('have.value', 'test-sklearn-model')
        .and('have.attr', 'readonly');

      // Framework should show Scikit-learn (from legacy sklearn predictor)
      cy.get('mat-select[formControlName="modelFramework"]').should(
        'contain',
        'Scikit-learn',
      );

      // Storage URI from the test model
      cy.get('input[formControlName="storageUri"]').should(
        'have.value',
        'gs://test-bucket/sklearn-model',
      );
    });
  });

  it('should display pre-populated form fields from new-style model spec', () => {
    const newStyleModel = {
      metadata: {
        name: 'test-sklearn-model',
        namespace: 'kubeflow-user',
        creationTimestamp: '2024-01-15T10:30:00Z',
        resourceVersion: '67890',
        uid: 'test-uid-456',
      },
      spec: {
        predictor: {
          minReplicas: 2,
          maxReplicas: 5,
          model: {
            modelFormat: {
              name: 'tensorflow',
              version: '2',
            },
            storageUri: 'gs://test-bucket/tf-saved-model',
            runtime: 'kserve-tensorflow-serving',
            resources: {
              requests: { cpu: '500m', memory: '512Mi' },
              limits: { cpu: '2', memory: '2Gi', 'nvidia.com/gpu': '1' },
            },
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

    // Override the default inference service mock with the new-style model
    // and re-visit the page so the new intercept takes effect
    // (beforeEach already visited with the legacy model)
    cy.intercept(
      'GET',
      '/api/namespaces/kubeflow-user/inferenceservices/test-sklearn-model',
      {
        statusCode: 200,
        body: { inferenceService: newStyleModel },
      },
    ).as('getInferenceService');

    cy.visit('/details/kubeflow-user/test-sklearn-model');
    waitForPageLoad();

    // Enter edit mode
    cy.get('lib-title-actions-toolbar').within(() => {
      cy.get('button').contains('EDIT').click();
    });

    // Wait for edit form
    cy.get('app-edit form.edit-form', { timeout: 10000 }).should('be.visible');

    // Verify form fields are pre-populated from the new-style model spec
    cy.get('app-edit').within(() => {
      // Model name read-only
      cy.get('input[formControlName="modelName"]').should(
        'have.value',
        'test-sklearn-model',
      );

      // Framework from model.modelFormat.name
      cy.get('mat-select[formControlName="modelFramework"]').should(
        'contain',
        'TensorFlow',
      );

      // Storage URI from model.storageUri
      cy.get('input[formControlName="storageUri"]').should(
        'have.value',
        'gs://test-bucket/tf-saved-model',
      );

      // Framework version from model.modelFormat.version
      cy.get('input[formControlName="frameworkVersion"]').should(
        'have.value',
        '2',
      );

      // Runtime from model.runtime
      cy.get('input[formControlName="runtime"]').should(
        'have.value',
        'kserve-tensorflow-serving',
      );

      // Scaling from predictor level
      cy.get('input[formControlName="minReplicas"]').should('have.value', '2');
      cy.get('input[formControlName="maxReplicas"]').should('have.value', '5');

      // Resources from model.resources
      cy.get('input[formControlName="cpuRequest"]').should(
        'have.value',
        '500m',
      );
      cy.get('input[formControlName="memoryRequest"]').should(
        'have.value',
        '512Mi',
      );
      cy.get('input[formControlName="cpuLimit"]').should('have.value', '2');
      cy.get('input[formControlName="memoryLimit"]').should(
        'have.value',
        '2Gi',
      );
      cy.get('input[formControlName="gpuCount"]').should('have.value', '1');
    });
  });

  it('should successfully submit edited model', () => {
    // Mock successful update
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

    waitForPageLoad();

    // Enter edit mode
    cy.get('lib-title-actions-toolbar').within(() => {
      cy.get('button').contains('EDIT').click();
    });

    // Wait for edit form
    cy.get('app-edit form.edit-form', { timeout: 10000 }).should('be.visible');

    // Edit the storage URI (same change the old YAML test made)
    cy.get('app-edit').within(() => {
      cy.get('input[formControlName="storageUri"]')
        .clear()
        .type('gs://test-bucket/updated-sklearn-model');
    });

    // Submit the changes
    cy.get('app-edit').within(() => {
      cy.get('button').contains('Submit').click();
    });

    // Verify API call was made with correct body
    cy.wait('@updateInferenceService').then(interception => {
      const body = interception.request.body;
      expect(body.metadata.name).to.equal('test-sklearn-model');
      expect(body.metadata.resourceVersion).to.equal('12345');
      expect(body.spec.predictor.model.storageUri).to.equal(
        'gs://test-bucket/updated-sklearn-model',
      );
    });

    // Verify success notification
    cy.get('.mat-snack-bar-container', { timeout: 5000 })
      .should('be.visible')
      .and('contain', 'successfully updated');

    // Verify edit mode is exited
    cy.get('app-edit').should('not.exist');

    // Tabs should be visible again
    cy.get('mat-tab-group', { timeout: 10000 }).should('be.visible');
  });

  it('should cancel edit when cancel button is clicked', () => {
    waitForPageLoad();

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

    // Wait for tabs to appear after cancel
    cy.get('mat-tab-group', { timeout: 10000 }).should('be.visible');
  });

  it('should handle edit submission errors gracefully', () => {
    // Mock failed update
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

    waitForPageLoad();

    // Enter edit mode
    cy.get('lib-title-actions-toolbar').within(() => {
      cy.get('button').contains('EDIT').click();
    });

    // Wait for edit form
    cy.get('app-edit form.edit-form', { timeout: 10000 }).should('be.visible');

    // Submit without changes (test error handling)
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

  it('should prevent submission with invalid form data', () => {
    waitForPageLoad();

    // Enter edit mode
    cy.get('lib-title-actions-toolbar').within(() => {
      cy.get('button').contains('EDIT').click();
    });

    // Wait for edit form
    cy.get('app-edit form.edit-form', { timeout: 10000 }).should('be.visible');

    // Clear the required storageUri field
    cy.get('app-edit').within(() => {
      cy.get('input[formControlName="storageUri"]').clear();
      // Click elsewhere to trigger validation (modelName is disabled, so use heading)
      cy.get('h3').first().click();
    });

    // Submit button should be disabled
    cy.get('app-edit').within(() => {
      cy.get('button[color="primary"]').should('be.disabled');
    });

    // Verify edit mode is still active
    cy.get('app-edit').should('be.visible');
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
