import './commands'

// Hide fetch/XHR requests from command log
Cypress.on('window:before:load', (win) => {
  cy.stub(win.console, 'log').as('consoleLog')
  cy.stub(win.console, 'error').as('consoleError')
})