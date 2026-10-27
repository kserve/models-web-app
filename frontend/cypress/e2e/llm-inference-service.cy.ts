describe('Models Web App - LLMInferenceService Tests', () => {
  const testServiceName = 'sample-facebook-opt-125m';
  const testNamespace = 'kubeflow-user';

  /*
   * Modeled on a real object observed on a live cluster: a specification
   * that references a base configuration the cluster had not installed,
   * left at Ready Unknown with a failed PresetsCombined condition. That
   * non-happy-path state is what a debugging user actually encounters, so
   * it is a more useful fixture than an invented fully ready object.
   */
  const mockLLMInferenceService = {
    apiVersion: 'serving.kserve.io/v1alpha2',
    kind: 'LLMInferenceService',
    metadata: {
      name: testServiceName,
      namespace: testNamespace,
      creationTimestamp: '2024-01-01T00:00:00Z',
    },
    spec: {
      baseRefs: [{ name: 'sample-single-node-configuration' }],
      model: {
        uri: 'hf://facebook/opt-125m',
        name: 'facebook/opt-125m',
      },
    },
    status: {
      conditions: [
        {
          type: 'PresetsCombined',
          status: 'False',
          reason: 'ConfigNotFound',
          message:
            'LLMInferenceServiceConfig "kserve-config-llm-router-route" not found',
        },
        {
          type: 'Ready',
          status: 'Unknown',
          reason: 'NewObservedGenFailure',
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

    cy.intercept('GET', '/api/namespaces', {
      statusCode: 200,
      body: {
        namespaces: [{ name: testNamespace, status: 'Active' }],
      },
    }).as('getNamespacesList');

    cy.intercept('GET', '/api/config/namespaces', {
      statusCode: 200,
      body: { namespaces: [testNamespace] },
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

  it('navigates to the LLMInferenceServices page from the endpoints toolbar', () => {
    cy.intercept(
      'GET',
      `/api/namespaces/${testNamespace}/llminferenceservices`,
      {
        statusCode: 200,
        body: { llmInferenceServices: [] },
      },
    ).as('getLLMInferenceServicesEmpty');

    cy.visit('/');
    cy.wait('@getConfig');

    cy.contains('button', 'View LLMInferenceServices').click();
    cy.url().should('include', '/llm-inference-services');
  });

  it('loads the LLMInferenceServices page successfully', () => {
    cy.intercept(
      'GET',
      `/api/namespaces/${testNamespace}/llminferenceservices`,
      {
        statusCode: 200,
        body: { llmInferenceServices: [] },
      },
    ).as('getLLMInferenceServicesEmpty');

    cy.visit('/llm-inference-services');
    cy.wait('@getConfig');

    cy.get('app-llm-inference-service', { timeout: 5000 }).should('exist');
    cy.contains('LLMInferenceServices').should('be.visible');
  });

  it('displays LLMInferenceServices in a table with the derived topology and status', () => {
    cy.intercept(
      'GET',
      `/api/namespaces/${testNamespace}/llminferenceservices`,
      {
        statusCode: 200,
        body: { llmInferenceServices: [mockLLMInferenceService] },
      },
    ).as('getLLMInferenceServices');

    cy.visit('/llm-inference-services');
    cy.wait('@getConfig');
    cy.wait('@getLLMInferenceServices');

    cy.get('lib-table', { timeout: 10000 }).should('exist');
    cy.contains(testServiceName, { timeout: 10000 }).should('be.visible');
    cy.contains('From configuration', { timeout: 10000 }).should('be.visible');
  });

  it('navigates to the details page when a name is clicked', () => {
    cy.intercept(
      'GET',
      `/api/namespaces/${testNamespace}/llminferenceservices`,
      {
        statusCode: 200,
        body: { llmInferenceServices: [mockLLMInferenceService] },
      },
    ).as('getLLMInferenceServices');

    cy.intercept(
      'GET',
      `/api/namespaces/${testNamespace}/llminferenceservices/${testServiceName}`,
      {
        statusCode: 200,
        body: { llmInferenceService: mockLLMInferenceService },
      },
    ).as('getLLMInferenceService');

    cy.intercept(
      'GET',
      `/api/namespaces/${testNamespace}/llminferenceservices/${testServiceName}/events`,
      { statusCode: 200, body: { events: [] } },
    ).as('getEvents');

    cy.visit('/llm-inference-services');
    cy.wait('@getConfig');
    cy.wait('@getLLMInferenceServices');

    cy.contains(testServiceName, { timeout: 10000 }).click();

    cy.url({ timeout: 10000 }).should('include', '/llm-details');
    cy.get('app-llm-details', { timeout: 10000 }).should('exist');
  });

  it('displays the details page with conditions and the effective topology', () => {
    cy.intercept(
      'GET',
      `/api/namespaces/${testNamespace}/llminferenceservices/${testServiceName}`,
      {
        statusCode: 200,
        body: { llmInferenceService: mockLLMInferenceService },
      },
    ).as('getLLMInferenceService');

    cy.intercept(
      'GET',
      `/api/namespaces/${testNamespace}/llminferenceservices/${testServiceName}/events`,
      { statusCode: 200, body: { events: [] } },
    ).as('getEvents');

    cy.visit(`/llm-details/${testNamespace}/${testServiceName}`);
    cy.wait('@getConfig');
    cy.wait('@getLLMInferenceService', { timeout: 10000 });
    cy.wait('@getEvents', { timeout: 10000 });

    cy.get('app-llm-details', { timeout: 10000 }).should('exist');
    cy.contains(testServiceName, { timeout: 10000 }).should('be.visible');

    // The overview tab renders the effective topology, not just raw YAML.
    cy.contains('From configuration', { timeout: 10000 }).should('be.visible');
    cy.contains('sample-single-node-configuration', { timeout: 10000 }).should(
      'be.visible',
    );

    // The conditions table surfaces the failure message a debugging user
    // needs, not only the resource's overall status icon.
    cy.contains('PresetsCombined', { timeout: 10000 }).should('be.visible');
    cy.contains('ConfigNotFound', { timeout: 10000 }).should('be.visible');

    cy.contains('.mat-mdc-tab', 'YAML').click();
    cy.get('.yaml-content', { timeout: 10000 }).should(
      'contain.text',
      testServiceName,
    );
  });
});
