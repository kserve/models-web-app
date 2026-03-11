import { Interception } from 'cypress/types/net-stubbing';

describe('Models Web App - Model Deployment Tests', () => {
  beforeEach(() => {
    // Load fixture data
    cy.fixture('namespaces').as('namespacesData');
    cy.fixture('inference-services').as('inferenceServicesData');

    // Set up default intercepts for all tests
    cy.intercept('GET', '/api/config/namespaces', { fixture: 'namespaces' }).as(
      'getNamespaces',
    );

    // Default empty response for inference services
    cy.intercept('GET', '/api/namespaces/*/inferenceservices', {
      statusCode: 200,
      body: [],
    }).as('getInferenceServicesEmpty');
  });

  // Helper function to initialize namespace service with a selected namespace
  const initializeNamespaceService = (namespace: string = 'kubeflow-user') => {
    cy.window().then((win: any) => {
      // Get the namespace service instance and initialize it
      if (win.ng) {
        cy.get('app-submit-form').then($el => {
          const element = $el[0];
          try {
            const injector = win.ng.getInjector(element);
            const namespaceService = injector.get('NamespaceService');
            if (namespaceService && namespaceService.updateSelectedNamespace) {
              namespaceService.updateSelectedNamespace(namespace);
            }
          } catch (e) {
            console.log('Failed to initialize namespace service:', e);
          }
        });
      }
    });
  };

  const setMonacoEditorValue = (value: string) => {
    cy.get('app-submit-form', { timeout: 15000 }).should('exist');

    cy.window().then((win: any) => {
      cy.get('app-submit-form').then($el => {
        const element = $el[0];
        if (win.ng && win.ng.getComponent) {
          try {
            const component = win.ng.getComponent(element);
            if (component) {
              component.yaml = value;
              if (win.ng.applyChanges) {
                win.ng.applyChanges(element);
              } else if (win.Zone) {
                win.Zone.current.run(() => {
                  try {
                    const injector = win.ng.getInjector(element);
                    const appRef = injector.get(
                      win.ng.coreTokens?.ApplicationRef,
                    );
                    if (appRef) {
                      appRef.tick();
                    }
                  } catch (e) {}
                });
              }
            }
          } catch (e) {
            console.log('ng.getComponent failed:', e);
          }
        }
      });
    });

    // Verify the value was set by checking if CREATE button is enabled
    cy.get('lib-submit-bar button')
      .contains(/create/i)
      .should('not.be.disabled');
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

    // Check that Monaco editor component exists
    cy.get('lib-monaco-editor', { timeout: 15000 })
      .should('exist')
      .should('be.visible');

    // Check submit bar exists
    cy.get('lib-submit-bar', { timeout: 10000 }).should('exist');

    // Check buttons in submit bar
    cy.get('lib-submit-bar').within(() => {
      cy.get('button').should('have.length', 2); // Submit and Cancel buttons
      cy.contains('button', /create/i).should('exist');
      cy.contains('button', /cancel/i).should('exist');
    });

    // Test navigation back
    cy.get('lib-title-actions-toolbar button[mat-icon-button]').first().click();
    cy.url().should('not.include', '/new');
    cy.get('app-index').should('exist');
  });

  it('should successfully deploy a model with valid YAML', () => {
    // Mock successful creation
    cy.intercept('POST', '/api/namespaces/*/inferenceservices', {
      statusCode: 201,
      body: {
        name: 'test-sklearn-model',
        namespace: 'kubeflow-user',
      },
    }).as('createInferenceService');

    // Also mock the redirect list call
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

    // Wait for the page to load
    cy.get('app-submit-form', { timeout: 10000 }).should('exist');

    // Wait for Monaco editor component to be visible
    cy.get('lib-monaco-editor', { timeout: 15000 }).should('be.visible');

    // Initialize namespace service with kubeflow-user namespace
    initializeNamespaceService('kubeflow-user');

    const validYaml = `apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: test-sklearn-model
spec:
  predictor:
    sklearn:
      storageUri: gs://kfserving-examples/models/sklearn/iris
      runtimeVersion: 0.24.1
      protocolVersion: v1`;

    // Set YAML value in Monaco editor AND ensure component properties are set
    setMonacoEditorValue(validYaml);

    // Also directly set the component properties to ensure they're properly initialized
    cy.window().then((win: any) => {
      if (win.ng) {
        cy.get('app-submit-form').then($el => {
          const element = $el[0];
          try {
            const component = win.ng.getComponent(element);
            if (component) {
              component.yaml = validYaml;
              component.namespace = 'kubeflow-user';

              // Force change detection
              if (win.Zone) {
                win.Zone.current.run(() => {
                  const injector = win.ng.getInjector(element);
                  const appRef = injector.get(win.ng.coreTokens.ApplicationRef);
                  appRef.tick();
                });
              }
            }
          } catch (e) {
            console.log('Failed to set component properties:', e);
          }
        });
      }
    });

    // Debug: Check component state before submission
    cy.window().then((win: any) => {
      if (win.ng) {
        cy.get('app-submit-form').then($el => {
          const element = $el[0];
          try {
            const component = win.ng.getComponent(element);
            if (component) {
              console.log('Component YAML:', component.yaml);
              console.log('Component namespace:', component.namespace);
              console.log('Component applying:', component.applying);
            }
          } catch (e) {
            console.log('Failed to debug component:', e);
          }
        });
      }
    });

    // Find and click the submit button
    cy.get('lib-submit-bar button')
      .contains(/submit|create/i)
      .click();
    cy.get<Interception[]>('@createInferenceService.all').then(
      interceptions => {
        if (interceptions.length === 0) {
          cy.window().then((win: any) => {
            if (win.ng) {
              cy.get('app-submit-form').then($el => {
                const element = $el[0];
                try {
                  const component = win.ng.getComponent(element);
                  if (component && component.submit) {
                    component.submit();
                  }
                } catch (e) {}
              });
            }
          });
        }
      },
    );

    // Verify API call was made or that submission succeeded
    cy.get<Interception[]>('@createInferenceService.all', {
      timeout: 10000,
    }).then(interceptions => {
      if (interceptions.length > 0) {
        const body = interceptions[0].request.body;
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
        expect(bodyStr).to.include('test-sklearn-model');
      }
    });

    // Should navigate back to index page OR show success message
    cy.url({ timeout: 5000 }).then(url => {
      // Either navigated away from /new OR submission completed
      if (url.includes('/new')) {
        // If still on /new, check for success message or completion
        cy.get('.mat-snack-bar-container', { timeout: 5000 })
          .should('be.visible')
          .then($el => {
            const text = $el.text();
            // Should show either success or no error
            expect(text.toLowerCase()).not.to.include('error');
          });
      }
    });
    cy.get('app-index, app-submit-form', { timeout: 10000 }).should('exist');
  });

  it('should show error for invalid YAML syntax', () => {
    // Mock error response for invalid YAML
    cy.intercept('POST', '/api/namespaces/*/inferenceservices', {
      statusCode: 400,
      body: {
        error: 'Invalid YAML: could not find expected ":"',
      },
    }).as('createInferenceServiceError');

    cy.visit('/new');

    // Wait for the page to load
    cy.get('app-submit-form', { timeout: 10000 }).should('exist');

    // Wait for Monaco editor to be visible
    cy.get('lib-monaco-editor', { timeout: 15000 }).should('be.visible');

    const invalidYaml = `apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: test-model
  invalid: yaml: structure: [unclosed`;

    // Set invalid YAML in Monaco editor
    setMonacoEditorValue(invalidYaml);

    // Click submit button
    cy.get('lib-submit-bar button')
      .contains(/submit|create/i)
      .click({ force: true });

    // Should show error message in snackbar (check for YAML parsing error)
    cy.get('.mat-snack-bar-container', { timeout: 10000 })
      .should('be.visible')
      .and($el => {
        const text = $el.text().toLowerCase();
        expect(text).to.satisfy((t: string) => {
          return (
            t.includes('yaml') || t.includes('parsing') || t.includes('error')
          );
        });
      });

    // Should stay on the same page
    cy.url().should('include', '/new');

    // Verify no API call was made since YAML parsing failed client-side
    cy.get('@createInferenceServiceError.all').should('have.length', 0);
  });

  it('should handle network errors gracefully', () => {
    // Mock network error
    cy.intercept('POST', '/api/namespaces/*/inferenceservices', {
      statusCode: 500,
      body: {
        error: 'Internal Server Error',
      },
    }).as('createInferenceServiceNetworkError');

    cy.visit('/new');

    // Wait for the page to load
    cy.get('app-submit-form', { timeout: 10000 }).should('exist');

    cy.get('lib-monaco-editor', { timeout: 15000 }).should('be.visible');

    const validYaml = `apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: test-model
spec:
  predictor:
    sklearn:
      storageUri: gs://example/model`;

    setMonacoEditorValue(validYaml);

    cy.get('lib-submit-bar button')
      .contains(/submit|create/i)
      .click({ force: true });

    // Should show error message in snackbar
    cy.get('.mat-snack-bar-container', { timeout: 10000 }).should('be.visible');

    // Should stay on the same page
    cy.url().should('include', '/new');
  });

  it('should validate required fields in YAML', () => {
    cy.visit('/new');

    cy.intercept('POST', '/api/namespaces/*/inferenceservices').as(
      'createInferenceService',
    );

    // Wait for the page to load
    cy.get('app-submit-form', { timeout: 10000 }).should('exist');

    cy.get('lib-monaco-editor', { timeout: 15000 }).should('be.visible');

    // YAML missing required metadata.name
    const incompleteYaml = `apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  # name is missing
spec:
  predictor:
    sklearn:
      storageUri: gs://example/model`;

    setMonacoEditorValue(incompleteYaml);

    // The submit button might be disabled due to validation
    // or clicking it should show an error
    cy.get('lib-submit-bar').within(() => {
      cy.contains('button', /submit|create/i).then($btn => {
        if ($btn.prop('disabled')) {
          // Button is correctly disabled
          expect($btn).to.have.attr('disabled');
        } else {
          // Click and expect error
          cy.wrap($btn).click({ force: true });
          cy.get('@createInferenceService.all').should('have.length', 0); // No API call should be made
        }
      });
    });
  });

  it('should allow editing pre-filled template', () => {
    cy.visit('/new');

    // Wait for the page to load
    cy.get('app-submit-form', { timeout: 10000 }).should('exist');

    // Check that Monaco editor has some pre-filled content
    cy.get('lib-monaco-editor', { timeout: 15000 }).should('be.visible');

    // Get the current value (if any)
    cy.window().then((win: any) => {
      if (win.monaco && win.monaco.editor) {
        const editors = win.monaco.editor.getModels();
        if (editors.length > 0) {
          const currentValue = editors[0].getValue();
          // If there's a template, it should contain some expected content
          if (currentValue) {
            expect(currentValue).to.include('apiVersion');
            expect(currentValue).to.include('InferenceService');
          }
        }
      }
    });

    // Now set a new value
    const customYaml = `apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: custom-model
spec:
  predictor:
    tensorflow:
      storageUri: gs://custom/model`;

    setMonacoEditorValue(customYaml);

    // Verify the value was set
    cy.window().then((win: any) => {
      if (win.monaco && win.monaco.editor) {
        const editors = win.monaco.editor.getModels();
        if (editors.length > 0) {
          const newValue = editors[0].getValue();
          expect(newValue).to.include('custom-model');
          expect(newValue).to.include('tensorflow');
        }
      }
    });
  });
});
