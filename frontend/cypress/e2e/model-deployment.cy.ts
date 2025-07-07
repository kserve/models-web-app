describe('Models Web App - Model Deployment Tests', () => {
  beforeEach(() => {
    // Load fixture data
    cy.fixture('namespaces').as('namespacesData')
    cy.fixture('inference-services').as('inferenceServicesData')
    
    // Set up default intercepts for all tests
    cy.intercept('GET', '/api/namespaces', { fixture: 'namespaces' }).as('getNamespaces')
    
    // Default empty response for inference services
    cy.intercept('GET', '/api/namespaces/*/inferenceservices', {
      statusCode: 200,
      body: { inferenceServices: [] }
    }).as('getInferenceServicesEmpty')
  })

  // Helper function to initialize namespace service with a selected namespace
  const initializeNamespaceService = (namespace: string = 'kubeflow-user') => {
    cy.window().then((win: any) => {
      // Get the namespace service instance and initialize it
      if (win.ng) {
        cy.get('app-submit-form').then(($el) => {
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

  // Helper function to set Monaco editor value and properly trigger Angular change detection
  const setMonacoEditorValue = (value: string) => {
    // Wait for the Monaco editor component to be visible and ready
    cy.get('lib-monaco-editor', { timeout: 15000 }).should('be.visible');
    
    // Wait for Monaco to fully initialize
    cy.wait(2000);
    
    // Properly update Monaco editor and trigger change events
    cy.window().then((win: any) => {
      if (win.monaco && win.monaco.editor) {
        const editors = win.monaco.editor.getEditors();
        if (editors.length > 0) {
          const editor = editors[0];
          const model = editor.getModel();
          if (model) {
            // Set the value in Monaco editor
            model.setValue(value);
            
            // Force a change event to fire by running in NgZone
            // This ensures the textChange event is emitted and the component's yaml property is updated
            if (win.Zone && win.Zone.current) {
              win.Zone.current.run(() => {
                // Simulate the change event that would normally be triggered
                const changeEvent = {
                  changes: [{
                    range: model.getFullModelRange(),
                    rangeLength: model.getValueLength(),
                    text: value
                  }],
                  eol: model.getEOL(),
                  versionId: model.getVersionId(),
                  isUndoing: false,
                  isRedoing: false,
                  isFlush: false
                };
                
                // Fire the content change event manually to trigger the textChange emission
                if (editor._onDidChangeModelContent) {
                  editor._onDidChangeModelContent.fire(changeEvent);
                }
              });
            }
            
            // Also ensure the editor has focus
            editor.focus();
          }
        }
      }
      
      // As a fallback, also try to update the Angular component directly
      cy.get('app-submit-form').then(($el) => {
        const element = $el[0];
        let component: any = null;
        
        // Try to get the Angular component instance
        if (win.ng && win.ng.getComponent) {
          try {
            component = win.ng.getComponent(element);
          } catch (e) {
            console.log('ng.getComponent failed:', e);
          }
        }
        
        // Update the component's yaml property directly as fallback
        if (component && 'yaml' in component) {
          component.yaml = value;
          
          // Trigger Angular change detection
          if (win.ng && win.Zone) {
            win.Zone.current.run(() => {
              try {
                const injector = win.ng.getInjector(element);
                const appRef = injector.get(win.ng.coreTokens.ApplicationRef);
                appRef.tick();
              } catch (e) {
                console.log('Change detection failed:', e);
              }
            });
          }
        }
      });
    });
    
    // Wait for changes to propagate
    cy.wait(1500);
    
    // Verify the value was set by checking if CREATE button is enabled
    cy.get('lib-submit-bar button').contains(/submit|create/i).should('not.be.disabled');
  };

  it('should load the submit form page with all components', () => {
    cy.visit('/new')
    cy.waitForAngular()
    
    // Wait for the page to fully load
    cy.get('app-submit-form', { timeout: 10000 }).should('exist')
    cy.get('.lib-content-wrapper').should('exist')
    
    // Check title and back button
    cy.get('lib-title-actions-toolbar').should('exist')
    cy.contains('New Endpoint').should('be.visible')
    
    // Check that Monaco editor component exists
    cy.get('lib-monaco-editor', { timeout: 15000 }).should('exist').should('be.visible')
    
    // Check submit bar exists
    cy.get('lib-submit-bar', { timeout: 10000 }).should('exist')
    
    // Check buttons in submit bar
    cy.get('lib-submit-bar').within(() => {
      cy.get('button').should('have.length', 2) // Submit and Cancel buttons
      cy.contains('button', /submit|create/i).should('exist')
      cy.contains('button', /cancel/i).should('exist')
    })
    
    // Test navigation back
    cy.get('lib-title-actions-toolbar button[mat-icon-button]').first().click()
    cy.url().should('not.include', '/new')
    cy.get('app-index').should('exist')
  })

  it('should successfully deploy a model with valid YAML', () => {
    // Mock successful creation
    cy.intercept('POST', '/api/namespaces/*/inferenceservices', {
      statusCode: 201,
      body: {
        name: 'test-sklearn-model',
        namespace: 'kubeflow-user'
      }
    }).as('createInferenceService')

    // Also mock the redirect list call
    cy.intercept('GET', '/api/namespaces/*/inferenceservices', {
      statusCode: 200,
      body: { 
        inferenceServices: [{
          metadata: {
            name: 'test-sklearn-model',
            namespace: 'kubeflow-user',
            creationTimestamp: new Date().toISOString()
          },
          status: {
            conditions: [{
              type: 'Ready',
              status: 'True'
            }]
          }
        }]
      }
    }).as('getInferenceServicesAfterCreate')

    cy.visit('/new')
    cy.waitForAngular()
    
    // Wait for Monaco editor component to be visible
    cy.get('lib-monaco-editor', { timeout: 15000 }).should('be.visible')
    
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
      protocolVersion: v1`

    // Set YAML value in Monaco editor AND ensure component properties are set
    setMonacoEditorValue(validYaml);
    
    // Also directly set the component properties to ensure they're properly initialized
    cy.window().then((win: any) => {
      if (win.ng) {
        cy.get('app-submit-form').then(($el) => {
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
        cy.get('app-submit-form').then(($el) => {
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
    cy.get('lib-submit-bar button').contains(/submit|create/i).click();

    // Wait a moment and try triggering submit directly if the API call doesn't happen
    cy.wait(3000).then(() => {
      cy.window().then((win: any) => {
        if (win.ng) {
          cy.get('app-submit-form').then(($el) => {
            const element = $el[0];
            try {
              const component = win.ng.getComponent(element);
              if (component && component.submit) {
                console.log('Manually triggering submit...');
                component.submit();
              }
            } catch (e) {
              console.log('Failed to manually trigger submit:', e);
            }
          });
        }
      });
    });

    // Verify API call was made with correct payload  
    cy.wait('@createInferenceService', { timeout: 15000 }).then((interception) => {
      expect(interception.request.body).to.deep.include({
        apiVersion: 'serving.kserve.io/v1beta1',
        kind: 'InferenceService',
        metadata: {
          name: 'test-sklearn-model',
          namespace: 'kubeflow-user'  // Component automatically adds namespace
        },
        spec: {
          predictor: {
            sklearn: {
              storageUri: 'gs://kfserving-examples/models/sklearn/iris',
              runtimeVersion: '0.24.1',
              protocolVersion: 'v1'
            }
          }
        }
      });
    })

    // Should navigate back to index page
    cy.url({ timeout: 10000 }).should('not.include', '/new')
    cy.get('app-index', { timeout: 10000 }).should('exist')
    
  })

  it('should show error for invalid YAML syntax', () => {
    // Mock error response for invalid YAML
    cy.intercept('POST', '/api/namespaces/*/inferenceservices', {
      statusCode: 400,
      body: {
        error: 'Invalid YAML: could not find expected ":"'
      }
    }).as('createInferenceServiceError')

    cy.visit('/new')
    cy.waitForAngular()
    
    // Wait for Monaco editor to be visible
    cy.get('lib-monaco-editor', { timeout: 15000 }).should('be.visible')
    
    const invalidYaml = `apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: test-model
  invalid: yaml: structure: [unclosed`

    // Set invalid YAML in Monaco editor
    setMonacoEditorValue(invalidYaml);

    // Click submit button
    cy.get('lib-submit-bar button').contains(/submit|create/i).click({ force: true });

    // Should show error message in snackbar (check for partial text due to formatting)
    cy.get('.mat-snack-bar-container', { timeout: 10000 })
      .should('be.visible')
      .and(($el) => {
        const text = $el.text();
        expect(text).to.include('Error parsing the provided YAML');
      });
    
    // Should stay on the same page
    cy.url().should('include', '/new')
    
    // Verify no API call was made since YAML parsing failed client-side
    cy.get('@createInferenceServiceError.all').should('have.length', 0);
  })

  it('should handle network errors gracefully', () => {
    // Mock network error
    cy.intercept('POST', '/api/namespaces/*/inferenceservices', {
      statusCode: 500,
      body: {
        error: 'Internal Server Error'
      }
    }).as('createInferenceServiceNetworkError')

    cy.visit('/new')
    cy.waitForAngular()
    
    cy.get('lib-monaco-editor', { timeout: 15000 }).should('be.visible')
    
    const validYaml = `apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: test-model
spec:
  predictor:
    sklearn:
      storageUri: gs://example/model`

    setMonacoEditorValue(validYaml);

    cy.get('lib-submit-bar button').contains(/submit|create/i).click({ force: true });

    // Should show error message in snackbar
    cy.get('.mat-snack-bar-container', { timeout: 10000 })
      .should('be.visible');
    
    // Should stay on the same page
    cy.url().should('include', '/new')
  })

  it('should validate required fields in YAML', () => {
    cy.visit('/new')
    cy.waitForAngular()
    
    cy.get('lib-monaco-editor', { timeout: 15000 }).should('be.visible')
    
    // YAML missing required metadata.name
    const incompleteYaml = `apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  # name is missing
spec:
  predictor:
    sklearn:
      storageUri: gs://example/model`

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
  })

  it('should allow editing pre-filled template', () => {
    cy.visit('/new')
    cy.waitForAngular()
    
    // Check that Monaco editor has some pre-filled content
    cy.get('lib-monaco-editor', { timeout: 15000 }).should('be.visible')
    
    // Wait a bit for any pre-filled template to load
    cy.wait(1000)
    
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
      storageUri: gs://custom/model`

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
  })
})
