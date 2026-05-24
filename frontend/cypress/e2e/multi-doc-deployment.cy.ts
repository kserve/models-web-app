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

  it('should POST all resources to the batch endpoint in YAML order', () => {
    cy.intercept('POST', '/api/namespaces/*/kserve-resources', {
      statusCode: 201,
      body: {
        message: '3 KServe resource(s) successfully created.',
        createdResources: [
          {
            apiVersion: 'serving.kserve.io/v1beta1',
            kind: 'InferenceService',
            name: 'triton-mms',
            namespace: NAMESPACE,
          },
          {
            apiVersion: 'serving.kserve.io/v1alpha1',
            kind: 'TrainedModel',
            name: 'cifar10',
            namespace: NAMESPACE,
          },
          {
            apiVersion: 'serving.kserve.io/v1alpha1',
            kind: 'TrainedModel',
            name: 'simple-string',
            namespace: NAMESPACE,
          },
        ],
      },
    }).as('createKServeResources');

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

    setComponentState(yaml);
    clickSubmit();

    cy.wait('@createKServeResources', { timeout: 10000 })
      .its('request.body.resources')
      .should(resources => {
        expect(resources).to.have.length(3);
        expect(resources.map((resource: any) => resource.kind)).to.deep.eq([
          'InferenceService',
          'TrainedModel',
          'TrainedModel',
        ]);
        expect(
          resources.every(
            (resource: any) => resource.metadata.namespace === NAMESPACE,
          ),
        ).to.eq(true);
      });
  });

  it('should show an error and make no API calls for an unsupported resource kind', () => {
    cy.intercept('POST', '/api/namespaces/*/kserve-resources').as(
      'createKServeResources',
    );

    cy.visit('/new');

    const yaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deploy
spec:
  replicas: 1`;

    setComponentState(yaml);
    clickSubmit();

    cy.get('.mat-snack-bar-container', { timeout: 10000 })
      .should('be.visible')
      .invoke('text')
      .should('match', /unsupported resource/i);

    cy.get('@createKServeResources.all').should('have.length', 0);
    cy.url().should('include', '/new');
  });

  it('should keep the user on /new when the batch endpoint returns partial failure', () => {
    cy.intercept('POST', '/api/namespaces/*/kserve-resources', {
      statusCode: 500,
      body: {
        message: 'Failed to create document 2 (TrainedModel/cifar10)',
        failedDocumentIndex: 2,
        failedResource: {
          apiVersion: 'serving.kserve.io/v1alpha1',
          kind: 'TrainedModel',
          name: 'cifar10',
          namespace: NAMESPACE,
        },
        createdResources: [
          {
            apiVersion: 'serving.kserve.io/v1beta1',
            kind: 'InferenceService',
            name: 'triton-mms',
            namespace: NAMESPACE,
          },
        ],
      },
    }).as('createKServeResources');

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

    cy.wait('@createKServeResources', { timeout: 10000 });
    cy.get('.mat-snack-bar-container', { timeout: 10000 })
      .should('be.visible')
      .invoke('text')
      .should('match', /failed to create document 2/i);
    cy.url().should('include', '/new');
  });
});
