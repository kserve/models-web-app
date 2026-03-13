describe('Multi-Document YAML Deployment', () => {
  const NAMESPACE = 'kubeflow-user';
  const setComponentState = (yaml: string) => {
    cy.get('app-submit-form', { timeout: 10000 }).should('exist');
    cy.window().then((win: any) => {
      if (!win.ng) return;
      cy.get('app-submit-form').then($el => {
        try {
          const component = win.ng.getComponent($el[0]);
          if (!component) return;
          component.yaml = yaml;
          component.namespace = NAMESPACE;
          if (win.Zone) {
            win.Zone.current.run(() => {
              const appRef = win.ng
                .getInjector($el[0])
                .get(win.ng.coreTokens?.ApplicationRef);
              appRef?.tick();
            });
          }
        } catch (e) {
          cy.log('Failed to set component state: ' + e);
        }
      });
    });
  };

  const clickSubmit = () => {
    cy.get('lib-submit-bar button')
      .contains(/create/i)
      .click({ force: true });
  };

  beforeEach(() => {
    cy.intercept('GET', '/api/config/namespaces', {
      fixture: 'namespaces',
    }).as('getNamespaces');

    cy.intercept('GET', '/api/namespaces/*/inferenceservices', {
      statusCode: 200,
      body: [],
    }).as('getInferenceServices');
  });

  it('should POST to both /inferenceservices and /trainedmodels for multi-doc YAML', () => {
    cy.intercept('POST', '/api/namespaces/*/inferenceservices', {
      statusCode: 201,
      body: { message: 'InferenceService successfully created.' },
    }).as('createInferenceService');

    cy.intercept('POST', '/api/namespaces/*/trainedmodels', {
      statusCode: 201,
      body: { message: 'TrainedModel successfully created.' },
    }).as('createTrainedModel');

    cy.visit('/new');

    const multiDocYaml = `apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: triton-mms
spec:
  predictor:
    model:
      modelFormat:
        name: triton
      protocolVersion: v2
---
apiVersion: serving.kserve.io/v1alpha1
kind: TrainedModel
metadata:
  name: cifar10
spec:
  inferenceService: triton-mms
  model:
    framework: pytorch
    storageUri: gs://kfserving-examples/models/torchscript/cifar10
    memory: 1Gi`;

    setComponentState(multiDocYaml);
    clickSubmit();

    // Both endpoints must be called exactly once
    cy.wait('@createInferenceService', { timeout: 10000 })
      .its('request.body')
      .should(body => {
        expect(body.kind).to.eq('InferenceService');
        expect(body.metadata.name).to.eq('triton-mms');
        expect(body.metadata.namespace).to.eq(NAMESPACE);
      });

    cy.wait('@createTrainedModel', { timeout: 10000 })
      .its('request.body')
      .should(body => {
        expect(body.kind).to.eq('TrainedModel');
        expect(body.metadata.name).to.eq('cifar10');
        expect(body.metadata.namespace).to.eq(NAMESPACE);
      });
  });

  it('should show an error and make no API calls for an unsupported resource kind', () => {
    cy.intercept('POST', '/api/namespaces/**', cy.spy().as('anyPost'));

    cy.visit('/new');

    const unsupportedKindYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deploy
spec:
  replicas: 1`;

    setComponentState(unsupportedKindYaml);
    clickSubmit();

    // Snackbar must appear with an error about the unsupported kind
    cy.get('.mat-snack-bar-container', { timeout: 10000 })
      .should('be.visible')
      .invoke('text')
      .should('match', /unsupported resource kind/i);

    // No POST request should have been made
    cy.get('@anyPost').should('not.have.been.called');

    // Should remain on the /new page
    cy.url().should('include', '/new');
  });

  it('should show an error when multi-doc YAML contains no InferenceService', () => {
    cy.intercept('POST', '/api/namespaces/**', cy.spy().as('anyPost'));

    cy.visit('/new');

    // Only a TrainedModel — no InferenceService document
    const trainedModelOnlyYaml = `apiVersion: serving.kserve.io/v1alpha1
kind: TrainedModel
metadata:
  name: cifar10
spec:
  inferenceService: triton-mms
  model:
    framework: pytorch
    storageUri: gs://kfserving-examples/models/torchscript/cifar10
    memory: 1Gi`;

    setComponentState(trainedModelOnlyYaml);
    clickSubmit();

    cy.get('.mat-snack-bar-container', { timeout: 10000 })
      .should('be.visible')
      .invoke('text')
      .should('match', /at least one inferenceservice/i);

    cy.get('@anyPost').should('not.have.been.called');
    cy.url().should('include', '/new');
  });

  it('should show an error when more than one InferenceService document is present', () => {
    cy.intercept('POST', '/api/namespaces/**', cy.spy().as('anyPost'));

    cy.visit('/new');

    const twoIsvcYaml = `apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: model-one
spec:
  predictor:
    sklearn:
      storageUri: gs://example/model1
---
apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: model-two
spec:
  predictor:
    sklearn:
      storageUri: gs://example/model2`;

    setComponentState(twoIsvcYaml);
    clickSubmit();

    cy.get('.mat-snack-bar-container', { timeout: 10000 })
      .should('be.visible')
      .invoke('text')
      .should('match', /only one inferenceservice/i);

    cy.get('@anyPost').should('not.have.been.called');
    cy.url().should('include', '/new');
  });

  it('should show an error when a TrainedModel is missing spec.inferenceService', () => {
    cy.intercept('POST', '/api/namespaces/**', cy.spy().as('anyPost'));

    cy.visit('/new');

    const missingRefYaml = `apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: triton-mms
spec:
  predictor:
    model:
      modelFormat:
        name: triton
---
apiVersion: serving.kserve.io/v1alpha1
kind: TrainedModel
metadata:
  name: broken-model
spec:
  model:
    framework: pytorch
    storageUri: gs://example/model
    memory: 1Gi`;

    setComponentState(missingRefYaml);
    clickSubmit();

    cy.get('.mat-snack-bar-container', { timeout: 10000 })
      .should('be.visible')
      .invoke('text')
      .should('match', /spec\.inferenceService/i);

    cy.get('@anyPost').should('not.have.been.called');
    cy.url().should('include', '/new');
  });

  it('should handle a 3-document YAML (InferenceService + 2 TrainedModels)', () => {
    cy.intercept('POST', '/api/namespaces/*/inferenceservices', {
      statusCode: 201,
      body: { message: 'InferenceService successfully created.' },
    }).as('createInferenceService');

    // Capture all TrainedModel POSTs
    cy.intercept('POST', '/api/namespaces/*/trainedmodels', {
      statusCode: 201,
      body: { message: 'TrainedModel successfully created.' },
    }).as('createTrainedModel');

    cy.visit('/new');

    const threeDocYaml = `apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: triton-mms
spec:
  predictor:
    model:
      modelFormat:
        name: triton
      protocolVersion: v2
---
apiVersion: serving.kserve.io/v1alpha1
kind: TrainedModel
metadata:
  name: cifar10
spec:
  inferenceService: triton-mms
  model:
    framework: pytorch
    storageUri: gs://kfserving-examples/models/torchscript/cifar10
    memory: 1Gi
---
apiVersion: serving.kserve.io/v1alpha1
kind: TrainedModel
metadata:
  name: simple-string
spec:
  inferenceService: triton-mms
  model:
    framework: tensorflow
    storageUri: gs://kfserving-examples/models/triton/simple_string
    memory: 1Gi`;

    setComponentState(threeDocYaml);
    clickSubmit();

    // InferenceService endpoint must be called
    cy.wait('@createInferenceService', { timeout: 10000 })
      .its('request.body.metadata.name')
      .should('eq', 'triton-mms');

    // At least one TrainedModel endpoint must be called
    cy.wait('@createTrainedModel', { timeout: 10000 })
      .its('request.body.kind')
      .should('eq', 'TrainedModel');
  });

  it('should keep the user on /new and show an error when the trainedmodels endpoint fails', () => {
    cy.intercept('POST', '/api/namespaces/*/inferenceservices', {
      statusCode: 201,
      body: { message: 'InferenceService successfully created.' },
    }).as('createInferenceService');

    cy.intercept('POST', '/api/namespaces/*/trainedmodels', {
      statusCode: 500,
      body: { log: 'Internal server error creating TrainedModel' },
    }).as('createTrainedModelError');

    cy.visit('/new');

    const yaml = `apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: triton-mms
spec:
  predictor:
    model:
      modelFormat:
        name: triton
---
apiVersion: serving.kserve.io/v1alpha1
kind: TrainedModel
metadata:
  name: cifar10
spec:
  inferenceService: triton-mms
  model:
    framework: pytorch
    storageUri: gs://example/model
    memory: 1Gi`;

    setComponentState(yaml);
    clickSubmit();

    cy.get('.mat-snack-bar-container', { timeout: 10000 }).should('be.visible');
    cy.url().should('include', '/new');
  });
});
