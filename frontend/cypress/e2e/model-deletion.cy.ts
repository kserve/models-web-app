describe('Models Web App - Model Deletion Tests', () => {
  beforeEach(() => {
    // Set up default intercepts for all tests
    cy.intercept('GET', '/api/namespaces', {
      statusCode: 200,
      body: {
        namespaces: ['kubeflow-user']
      }
    }).as('getNamespaces')
    
    // Mock inference services with sample data for deletion testing
    cy.intercept('GET', '/api/namespaces/*/inferenceservices', {
      statusCode: 200,
      body: {
        inferenceServices: [
          {
            metadata: {
              name: 'test-sklearn-model',
              namespace: 'kubeflow-user',
              creationTimestamp: '2024-01-15T10:30:00Z'
            },
            spec: {
              predictor: {
                sklearn: {
                  storageUri: 'gs://test-bucket/sklearn-model',
                  runtimeVersion: '0.24.1',
                  protocolVersion: 'v1'
                }
              }
            },
            status: {
              conditions: [
                {
                  type: 'Ready',
                  status: 'True',
                  lastTransitionTime: '2024-01-15T10:35:00Z'
                }
              ],
              url: 'http://test-sklearn-model.kubeflow-user.example.com'
            }
          },
          {
            metadata: {
              name: 'test-tensorflow-model',
              namespace: 'kubeflow-user',
              creationTimestamp: '2024-01-15T11:00:00Z'
            },
            spec: {
              predictor: {
                tensorflow: {
                  storageUri: 'gs://test-bucket/tensorflow-model',
                  runtimeVersion: '2.8.0',
                  protocolVersion: 'v1'
                }
              }
            },
            status: {
              conditions: [
                {
                  type: 'Ready',
                  status: 'True',
                  lastTransitionTime: '2024-01-15T11:05:00Z'
                }
              ],
              url: 'http://test-tensorflow-model.kubeflow-user.example.com'
            }
          }
        ]
      }
    }).as('getInferenceServicesWithData')
    
    cy.visit('/')
  })  

  it('should display delete buttons for inference services', () => {
    // Wait for data to load
    cy.wait('@getNamespaces')
    cy.wait('@getInferenceServicesWithData')

    // Verify table shows the models
    cy.get('lib-table', { timeout: 3000 }).should('exist')
    cy.get('lib-table').within(() => {
      cy.contains('test-sklearn-model').should('be.visible')
      cy.contains('test-tensorflow-model').should('be.visible')
    })

    // Verify delete buttons are present and enabled
    cy.get('lib-table').within(() => {
      cy.get('button[mat-icon-button]').then($buttons => {
        // Filter for delete buttons (should have delete icon)
        const deleteButtons = Array.from($buttons).filter(btn => {
          const icon = btn.querySelector('mat-icon');
          return icon && icon.textContent?.trim() === 'delete';
        });
        expect(deleteButtons).to.have.length.at.least(2);
      });
    })
  })

  it('should successfully delete a model with confirmation', () => {
    // Mock successful deletion
    cy.intercept('DELETE', '/api/namespaces/kubeflow-user/inferenceservices/test-sklearn-model', {
      statusCode: 200,
      body: { message: 'InferenceService deleted successfully' }
    }).as('deleteInferenceService')

    // Wait for initial data to load
    cy.wait('@getNamespaces')
    cy.wait('@getInferenceServicesWithData')

    // Find and click delete button for test-sklearn-model
    cy.get('lib-table').within(() => {
      // Find the row containing test-sklearn-model and click its delete button
      cy.contains('tr', 'test-sklearn-model').within(() => {
        cy.get('button[mat-icon-button]').contains('mat-icon', 'delete').click()
      })
    })

    // Verify confirmation dialog appears
    cy.get('mat-dialog-container', { timeout: 5000 }).should('be.visible')
    cy.get('mat-dialog-container').within(() => {
      cy.contains('Delete Endpoint test-sklearn-model?').should('be.visible')
      cy.contains('You cannot undo this action').should('be.visible')
      cy.get('button').contains('DELETE').should('be.visible')
      cy.get('button').contains('CANCEL').should('be.visible')
    })

    // Click DELETE button to confirm
    cy.get('mat-dialog-container').within(() => {
      cy.get('button').contains('DELETE').click()
    })

    // Verify API call was made
    cy.wait('@deleteInferenceService')

    // Verify dialog closes
    cy.get('mat-dialog-container').should('not.exist')

    // Verify the model row still exists after deletion is initiated
    cy.get('lib-table').within(() => {
      cy.contains('tr', 'test-sklearn-model').within(() => {
        // Verify status icon exists (deletion process may have changed its state)
        cy.get('lib-status-icon').should('exist')
      })
    })
  })

  it('should cancel deletion when CANCEL is clicked', () => {
    // Wait for initial data to load
    cy.wait('@getNamespaces')
    cy.wait('@getInferenceServicesWithData')

    // Find and click delete button for test-tensorflow-model
    cy.get('lib-table').within(() => {
      cy.contains('tr', 'test-tensorflow-model').within(() => {
        cy.get('button[mat-icon-button]').contains('mat-icon', 'delete').click()
      })
    })

    // Verify confirmation dialog appears
    cy.get('mat-dialog-container', { timeout: 5000 }).should('be.visible')
    cy.get('mat-dialog-container').within(() => {
      cy.contains('Delete Endpoint test-tensorflow-model?').should('be.visible')
    })

    // Click CANCEL button
    cy.get('mat-dialog-container').within(() => {
      cy.get('button').contains('CANCEL').click()
    })

    // Verify dialog closes
    cy.get('mat-dialog-container').should('not.exist')

    // Verify the model remains in ready state (no terminating status)
    cy.get('lib-table').within(() => {
      cy.contains('tr', 'test-tensorflow-model').within(() => {
        cy.contains('Preparing to delete').should('not.exist')
        // Should still be in ready/running state
        cy.get('lib-status-icon').should('exist')
      })
    })
  })

  it('should handle deletion errors gracefully', () => {
    // Mock deletion failure
    cy.intercept('DELETE', '/api/namespaces/kubeflow-user/inferenceservices/test-sklearn-model', {
      statusCode: 500,
      body: { error: 'Internal server error during deletion' }
    }).as('deleteInferenceServiceError')

    // Wait for initial data to load
    cy.wait('@getNamespaces')
    cy.wait('@getInferenceServicesWithData')

    // Find and click delete button
    cy.get('lib-table').within(() => {
      cy.contains('tr', 'test-sklearn-model').within(() => {
        cy.get('button[mat-icon-button]').contains('mat-icon', 'delete').click()
      })
    })

    // Confirm deletion
    cy.get('mat-dialog-container', { timeout: 5000 }).should('be.visible')
    cy.get('mat-dialog-container').within(() => {
      cy.get('button').contains('DELETE').click()
    })

    // Wait for failed API call
    cy.wait('@deleteInferenceServiceError')

    // Verify error is handled (dialog should remain open or show error)
    cy.get('mat-dialog-container').should('be.visible')
    
    // Cancel the dialog
    cy.get('mat-dialog-container').within(() => {
      cy.get('button').contains('CANCEL').click()
    })

    // Verify dialog closes and model remains in original state
    cy.get('mat-dialog-container').should('not.exist')
    cy.get('lib-table').within(() => {
      cy.contains('tr', 'test-sklearn-model').should('exist')
    })
  })

  it('should show confirmation dialog and handle API call', () => {
    // Mock deletion response
    cy.intercept('DELETE', '/api/namespaces/kubeflow-user/inferenceservices/test-sklearn-model', {
      statusCode: 200,
      body: { message: 'InferenceService deleted successfully' }
    }).as('deleteInferenceService')

    // Wait for initial data to load
    cy.wait('@getNamespaces')
    cy.wait('@getInferenceServicesWithData')

    // Initiate deletion
    cy.get('lib-table').within(() => {
      cy.contains('tr', 'test-sklearn-model').within(() => {
        cy.get('button[mat-icon-button]').contains('mat-icon', 'delete').click()
      })
    })

    // Confirm deletion
    cy.get('mat-dialog-container').within(() => {
      cy.get('button').contains('DELETE').click()
    })

    // Verify API call was made
    cy.wait('@deleteInferenceService')

    // Verify dialog closes
    cy.get('mat-dialog-container').should('not.exist')

    // Verify the model row still exists (it will show terminating state)
    cy.get('lib-table').within(() => {
      cy.contains('tr', 'test-sklearn-model').should('exist')
    })
  })

  it('should display terminating endpoints correctly', () => {
    // Mock data with terminating endpoint
    cy.intercept('GET', '/api/namespaces/*/inferenceservices', {
      statusCode: 200,
      body: {
        inferenceServices: [
          {
            metadata: {
              name: 'terminating-model',
              namespace: 'kubeflow-user',
              creationTimestamp: '2024-01-15T10:30:00Z',
              deletionTimestamp: '2024-01-15T12:00:00Z'
            },
            spec: {
              predictor: {
                sklearn: {
                  storageUri: 'gs://test-bucket/model',
                  runtimeVersion: '0.24.1'
                }
              }
            },
            status: {
              conditions: [
                {
                  type: 'Ready',
                  status: 'False',
                  reason: 'Terminating',
                  lastTransitionTime: '2024-01-15T12:00:00Z'
                }
              ]
            }
          }
        ]
      }
    }).as('getTerminatingService')

    // Reload to get new data
    cy.reload()
    cy.wait('@getNamespaces')
    cy.wait('@getTerminatingService')

    // Verify the terminating model is displayed
    cy.get('lib-table').within(() => {
      cy.contains('tr', 'terminating-model').should('exist')
      // Verify it has some kind of status indicator
      cy.contains('tr', 'terminating-model').within(() => {
        cy.get('lib-status-icon').should('exist')
      })
    })
  })

  it('should show delete button tooltip', () => {
    // Wait for data to load
    cy.wait('@getNamespaces')
    cy.wait('@getInferenceServicesWithData')

    // Hover over delete button to show tooltip
    cy.get('lib-table').within(() => {
      cy.contains('tr', 'test-sklearn-model').within(() => {
        cy.get('button[mat-icon-button]').contains('mat-icon', 'delete')
          .trigger('mouseenter')
      })
    })

    // Verify tooltip appears
    cy.get('.mat-tooltip', { timeout: 3000 })
      .should('be.visible')
      .and('contain', 'Delete endpoint')
  })
})
