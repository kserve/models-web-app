describe('KServe Models Web App - Basic Test', () => {
  it('should load the application and display basic elements', () => {
    // Visit the application
    cy.visit('/')
    
    // Wait a moment for the app to load
    cy.wait(2000)
    
    // Check that the page loads without crashing
    cy.get('body').should('exist')
    
    // Check for basic Angular elements
    cy.get('router-outlet').should('exist')
    
    // Verify the page title or any text that should be present
    cy.title().should('not.be.empty')
    
    // Log success
    cy.log('Basic Cypress test passed - app is loading correctly!')
  })

  it('should handle navigation', () => {
    cy.visit('/')
    
    // Check URL
    cy.url().should('include', 'localhost:4200')
    
    // Verify the page is interactive
    cy.get('body').should('be.visible')
  })
})
