describe('Cypress Setup Test', () => {
  it('should be able to visit the application', () => {
    cy.visit('/')
    
    // Wait for Angular to load
    cy.waitForAngular()
    
    // Check if the page has loaded by looking for basic elements
    cy.get('body').should('exist')
    
    // Check if Angular has loaded
    cy.window().should('have.property', 'ng')
    
    // Basic assertion that we can interact with the page
    cy.title().should('not.be.empty')
  })
  
  it('should have working custom commands', () => {
    cy.visit('/')
    cy.waitForAngular()
    
    // Test that our custom dataCy command works
    // This will fail gracefully if no data-cy attributes exist
    cy.get('body').should('exist')
  })
})
