describe('Models Web App - Model Deployment Tests', () => {
  beforeEach(() => {
    // Load fixture data
    cy.fixture('namespaces').as('namespacesData');
    cy.fixture('inference-services').as('inferenceServicesData');

    // Mock the configuration API
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
    }).as('getInferenceServicesEmpty');
  });

  /**
   * Map from form 'value' keys to their display labels as shown in the
   * mat-option list. Extracted from the frameworks[] array defined in
   * submit-form.component.ts.
   */
  const frameworkDisplayNames: Record<string, string> = {
    sklearn: 'Scikit-learn',
    xgboost: 'XGBoost',
    tensorflow: 'TensorFlow',
    pytorch: 'PyTorch',
    triton: 'Triton',
    onnx: 'ONNX',
    pmml: 'PMML',
    lightgbm: 'LightGBM',
    paddle: 'PaddlePaddle',
    huggingface: 'HuggingFace',
  };

  /**
   * Helper to fill the deployment form with provided values.
   * Values are extracted from the same model specs that the old YAML-based
   * tests used, so we exercise the same logical inputs.
   */
  const fillDeployForm = (opts: {
    modelName: string;
    modelFramework: string;
    storageUri: string;
    frameworkVersion?: string;
    runtime?: string;
    minReplicas?: number;
    maxReplicas?: number;
  }) => {
    // Model Name
    cy.get('input[formControlName="modelName"]').clear().type(opts.modelName);

    // Model Framework (mat-select) — select by display name
    const displayName =
      frameworkDisplayNames[opts.modelFramework] || opts.modelFramework;
    cy.get('mat-select[formControlName="modelFramework"]').click();
    cy.get('mat-option').contains(displayName).click();

    // Storage URI
    cy.get('input[formControlName="storageUri"]').clear().type(opts.storageUri);

    // Optional fields
    if (opts.frameworkVersion) {
      cy.get('input[formControlName="frameworkVersion"]')
        .clear()
        .type(opts.frameworkVersion);
    }
    if (opts.runtime) {
      cy.get('input[formControlName="runtime"]').clear().type(opts.runtime);
    }
    if (opts.minReplicas !== undefined) {
      cy.get('input[formControlName="minReplicas"]')
        .clear()
        .type(String(opts.minReplicas));
    }
    if (opts.maxReplicas !== undefined) {
      cy.get('input[formControlName="maxReplicas"]')
        .clear()
        .type(String(opts.maxReplicas));
    }
  };

  it('should navigate to submit form via button and load all components', () => {
    // Start from the home page
    cy.visit('/');
    cy.get('app-index', { timeout: 10000 }).should('exist');

    // Verify "New Endpoint" button exists and click it
    cy.contains('button', 'New Endpoint').should('be.visible').click();

    // Force a page reload at the new URL to avoid Angular stability issues
    cy.url().should('include', '/new');
    cy.reload();

    // Now test the form page components
    cy.get('app-submit-form', { timeout: 10000 }).should('exist');
    cy.get('.lib-content-wrapper').should('exist');

    // Check title and back button
    cy.get('lib-title-actions-toolbar').should('exist');
    cy.contains('New Endpoint').should('be.visible');

    // Check that the structured form exists with its sections
    cy.get('form.deploy-form').should('exist');
    cy.contains('h3', 'Model Info').should('be.visible');
    cy.contains('h3', 'Scaling').should('be.visible');
    cy.contains('h3', 'Resource Allocation').should('be.visible');

    // Check required form fields are present
    cy.get('input[formControlName="modelName"]').should('exist');
    cy.get('mat-select[formControlName="modelFramework"]').should('exist');
    cy.get('input[formControlName="storageUri"]').should('exist');

    // Check optional form fields are present
    cy.get('input[formControlName="frameworkVersion"]').should('exist');
    cy.get('input[formControlName="runtime"]').should('exist');
    cy.get('input[formControlName="minReplicas"]').should('exist');
    cy.get('input[formControlName="maxReplicas"]').should('exist');
    cy.get('input[formControlName="gpuCount"]').should('exist');

    // Check submit bar exists with CREATE and CANCEL buttons
    cy.get('lib-submit-bar', { timeout: 10000 }).should('exist');
    cy.get('lib-submit-bar').within(() => {
      cy.get('button').should('have.length', 2);
      cy.get('button[data-cy-submit-bar-create]').should('exist');
      cy.get('button[data-cy-submit-bar-cancel]').should('exist');
    });

    // Test navigation back
    cy.get('lib-title-actions-toolbar button[mat-icon-button]').first().click();
    cy.url().should('not.include', '/new');
    cy.get('app-index').should('exist');
  });

  it('should successfully deploy a model with valid form data', () => {
    // Values extracted from the old test's YAML:
    //   name: test-sklearn-model
    //   sklearn → storageUri: gs://kfserving-examples/models/sklearn/iris
    //   runtimeVersion: 0.24.1, protocolVersion: v1
    cy.intercept('POST', '/api/namespaces/*/inferenceservices', {
      statusCode: 201,
      body: {
        name: 'test-sklearn-model',
        namespace: 'kubeflow-user',
      },
    }).as('createInferenceService');

    // Mock the redirect list call
    cy.intercept('GET', '/api/namespaces/*/inferenceservices', {
      statusCode: 200,
      body: [
        {
          metadata: {
            name: 'test-sklearn-model',
            namespace: 'kubeflow-user',
            creationTimestamp: new Date().toISOString(),
          },
          status: {
            conditions: [
              {
                type: 'Ready',
                status: 'True',
              },
            ],
          },
        },
      ],
    }).as('getInferenceServicesAfterCreate');

    cy.visit('/new');
    cy.get('app-submit-form', { timeout: 10000 }).should('exist');

    // Fill form with the same values previously encoded in YAML
    fillDeployForm({
      modelName: 'test-sklearn-model',
      modelFramework: 'sklearn',
      storageUri: 'gs://kfserving-examples/models/sklearn/iris',
      frameworkVersion: '0.24.1',
    });

    // CREATE button should now be enabled
    cy.get('button[data-cy-submit-bar-create]').should('not.be.disabled');

    // Click submit
    cy.get('button[data-cy-submit-bar-create]').click();

    // Verify API call was made with expected structured JSON body
    cy.wait('@createInferenceService').then(interception => {
      const body = interception.request.body;
      expect(body.metadata.name).to.equal('test-sklearn-model');
      expect(body.spec.predictor.model.modelFormat.name).to.equal('sklearn');
      expect(body.spec.predictor.model.storageUri).to.equal(
        'gs://kfserving-examples/models/sklearn/iris',
      );
      expect(body.spec.predictor.model.modelFormat.version).to.equal('0.24.1');
    });

    // Should navigate back to index page or show success
    cy.get('app-index, app-submit-form', { timeout: 10000 }).should('exist');
  });

  it('should show validation errors for invalid form input', () => {
    // The old test used invalid YAML syntax (name: test-model, then garbage).
    // Instead we now test that the Angular reactive form validators prevent
    // submission when invalid input is provided.
    cy.visit('/new');
    cy.get('app-submit-form', { timeout: 10000 }).should('exist');

    // Type an invalid model name (uppercase and special characters violate
    // the pattern ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$)
    cy.get('input[formControlName="modelName"]').type('INVALID_NAME!');

    // Storage URI with invalid scheme (must be gs://, s3://, https?://, pvc://)
    cy.get('input[formControlName="storageUri"]').type('ftp://bad-scheme/model');

    // Touch the framework field without selecting a value to trigger required error
    cy.get('mat-select[formControlName="modelFramework"]').click();
    cy.get('.cdk-overlay-backdrop').click({ force: true });

    // Click somewhere else to trigger validation
    cy.get('input[formControlName="modelName"]').click();

    // CREATE button should be disabled due to validation errors
    cy.get('button[data-cy-submit-bar-create]').should('be.disabled');

    // Verify validation error messages are shown
    cy.get('mat-error').should('have.length.greaterThan', 0);

    // Should stay on the same page
    cy.url().should('include', '/new');
  });

  it('should handle network errors gracefully', () => {
    // Values extracted from the old test's YAML:
    //   name: test-model, sklearn, storageUri: gs://example/model
    cy.intercept('POST', '/api/namespaces/*/inferenceservices', {
      statusCode: 500,
      body: {
        error: 'Internal Server Error',
      },
    }).as('createInferenceServiceNetworkError');

    cy.visit('/new');
    cy.get('app-submit-form', { timeout: 10000 }).should('exist');

    // Fill form with the same values previously encoded in YAML
    fillDeployForm({
      modelName: 'test-model',
      modelFramework: 'sklearn',
      storageUri: 'gs://example/model',
    });

    // Submit the form
    cy.get('button[data-cy-submit-bar-create]').click();

    // Wait for the failed API call
    cy.wait('@createInferenceServiceNetworkError');

    // Should show error message in snackbar
    cy.get('.mat-snack-bar-container', { timeout: 10000 }).should('be.visible');

    // Should stay on the same page
    cy.url().should('include', '/new');
  });

  it('should validate required form fields', () => {
    // The old test submitted YAML without metadata.name.
    // For the new form, we verify that submitting without filling required
    // fields keeps the button disabled and shows errors.
    cy.intercept('POST', '/api/namespaces/*/inferenceservices').as(
      'createInferenceService',
    );

    cy.visit('/new');
    cy.get('app-submit-form', { timeout: 10000 }).should('exist');

    // Without filling any fields, the CREATE button should be disabled
    cy.get('button[data-cy-submit-bar-create]').should('be.disabled');

    // Fill only storageUri (same value from old YAML: gs://example/model)
    // but leave modelName and modelFramework empty
    cy.get('input[formControlName="storageUri"]').type('gs://example/model');

    // CREATE button should still be disabled (name + framework are required)
    cy.get('button[data-cy-submit-bar-create]').should('be.disabled');

    // No API call should have been made
    cy.get('@createInferenceService.all').should('have.length', 0);
  });

  it('should allow editing form values', () => {
    // The old test first checked the Monaco editor had a pre-filled template,
    // then set a custom YAML with name: custom-model, tensorflow,
    // storageUri: gs://custom/model. We reproduce the same flow.
    cy.visit('/new');
    cy.get('app-submit-form', { timeout: 10000 }).should('exist');

    // Fill initial values (original inputs from old test's first assertion)
    fillDeployForm({
      modelName: 'initial-model',
      modelFramework: 'sklearn',
      storageUri: 'gs://initial/model',
    });

    // Verify values are set
    cy.get('input[formControlName="modelName"]').should(
      'have.value',
      'initial-model',
    );
    cy.get('input[formControlName="storageUri"]').should(
      'have.value',
      'gs://initial/model',
    );

    // Now change values to the custom model (same as old test's YAML)
    cy.get('input[formControlName="modelName"]').clear().type('custom-model');

    cy.get('mat-select[formControlName="modelFramework"]').click();
    cy.get('mat-option').contains('TensorFlow').click();

    cy.get('input[formControlName="storageUri"]')
      .clear()
      .type('gs://custom/model');

    // Verify updated values persisted
    cy.get('input[formControlName="modelName"]').should(
      'have.value',
      'custom-model',
    );
    cy.get('input[formControlName="storageUri"]').should(
      'have.value',
      'gs://custom/model',
    );
    cy.get('mat-select[formControlName="modelFramework"]').should(
      'contain',
      'TensorFlow',
    );
  });
});
