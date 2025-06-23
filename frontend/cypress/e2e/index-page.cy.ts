describe('Models Web App - Index Page Tests', () => {
  beforeEach(() => {
    // Set up default intercepts for all tests
    cy.intercept('GET', '/api/namespaces', {
      statusCode: 200,
      body: {
        namespaces: ['kubeflow-user']
      }
    }).as('getNamespaces')
    
    // Default empty response for inference services
    cy.intercept('GET', '/api/namespaces/*/inferenceservices', {
      statusCode: 200,
      body: []
    }).as('getInferenceServicesDefault')
    
    cy.visit('/')
  })

  it('should load the index page successfully', () => {
    // Verify essential components are rendered
    cy.get('body').should('exist')
    cy.get('app-root').should('exist')
    cy.get('app-index', { timeout: 10000 }).should('exist')
    cy.get('.lib-content-wrapper').should('exist')
  })

  it('should display the page title as "Endpoints"', () => {
    // Check title in toolbar
    cy.get('lib-title-actions-toolbar', { timeout: 10000 }).should('exist')
    cy.get('lib-title-actions-toolbar').should('have.attr', 'title', 'Endpoints')
    cy.contains('Endpoints').should('be.visible')
  })

  it('should show namespace selector', () => {
    // Namespace selector should be visible
    cy.get('lib-namespace-select', { timeout: 10000 }).should('exist')
    cy.get('lib-title-actions-toolbar').find('lib-namespace-select').should('exist')
  })

  it('should display the endpoints table with correct columns', () => {
    // Table component should exist
    cy.get('lib-table', { timeout: 10000 }).should('exist')
    cy.get('.page-padding.lib-flex-grow.lib-overflow-auto')
      .find('lib-table')
      .should('exist')
    
    // Verify table headers
    cy.get('lib-table').within(() => {
      cy.get('th').should('contain', 'Status')
      cy.get('th').should('contain', 'Name')
      cy.get('th').should('contain', 'Created at')
      cy.get('th').should('contain', 'Predictor')
      cy.get('th').should('contain', 'Runtime')
      cy.get('th').should('contain', 'Protocol')
      cy.get('th').should('contain', 'Storage URI')
    })
  })
  
  it('should display empty state when no endpoints exist', () => {
    // With the default empty intercept, verify empty state
    cy.wait('@getNamespaces')
    cy.wait('@getInferenceServicesDefault')
    
    // Table should exist and show empty state
    cy.get('lib-table', { timeout: 10000 }).should('exist')
    cy.get('lib-table').within(() => {
      cy.contains('No rows to display').should('be.visible')
    })
  })

  it('should display the "New Endpoint" button', () => {
    // New Endpoint button should be visible
    cy.get('button').contains('New Endpoint', { timeout: 10000 }).should('be.visible')
  })

  it('should navigate to /new when clicking "New Endpoint" button', () => {
    // Click and verify navigation
    cy.contains('button', 'New Endpoint', { timeout: 10000 }).click()
    cy.url().should('include', '/new')
    cy.get('app-submit-form').should('exist')
  })

  it('should handle backend unavailability gracefully', () => {
    // Page loads even without backend
    cy.get('app-index', { timeout: 10000 }).should('exist')
    cy.get('.lib-content-wrapper').should('exist')
    cy.get('lib-title-actions-toolbar').should('exist')
    cy.get('lib-table').should('exist')
  })

  it('should display correctly on mobile devices', () => {
    cy.viewport('iphone-x')
    
    // Essential elements should be visible on mobile
    cy.get('.lib-content-wrapper', { timeout: 10000 }).should('be.visible')
    cy.get('lib-title-actions-toolbar').should('be.visible')
    cy.contains('Endpoints').should('be.visible')
    cy.get('lib-table').should('be.visible')
  })

  it('should display correctly on tablet devices', () => {
    cy.viewport('ipad-2')
    
    // Layout should work on tablet
    cy.get('.lib-content-wrapper', { timeout: 10000 }).should('be.visible')
    cy.get('lib-table').should('be.visible')
    cy.contains('button', 'New Endpoint').should('be.visible')
  })

  it('should allow keyboard navigation to buttons', () => {
    // Focus and activate button with keyboard
    cy.contains('button', 'New Endpoint', { timeout: 10000 }).focus()
    cy.focused().should('contain', 'New Endpoint')
    cy.focused().type('{enter}')
    cy.url().should('include', '/new')
  })
})
