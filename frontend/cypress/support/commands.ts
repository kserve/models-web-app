declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to select DOM element by data-cy attribute.
       * @example cy.dataCy('greeting')
       */
      dataCy(value: string): Chainable<JQuery<HTMLElement>>
      
      /**
       * Custom command to wait for Angular to be ready
       */
      waitForAngular(): Chainable<void>
    }
  }
}

Cypress.Commands.add('dataCy', (value: string) => {
  return cy.get(`[data-cy=${value}]`)
})

Cypress.Commands.add('waitForAngular', () => {
  cy.window().then((win: any) => {
    return new Cypress.Promise((resolve) => {
      if (win.getAllAngularTestabilities) {
        const testabilities = win.getAllAngularTestabilities()
        if (testabilities.length === 0) {
          resolve()
          return
        }
        let count = testabilities.length
        testabilities.forEach((testability: any) => {
          testability.whenStable(() => {
            count--
            if (count === 0) {
              resolve()
            }
          })
        })
      } else {
        resolve()
      }
    })
  })
})

export {}