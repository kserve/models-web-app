## Clean Coding standards

- The first reference documentation is the root level readme.md.
- We do test-driven development (GitHub actions and existing tests in backend, frontend, and common).
- Deleting code and adding tests is often more important than adding code.
- Code, documentation and feedback shall be in line with principal level scientific elegance, minimalism, conciseness and precision.
- Use explicitly long, expressive, pronounceable well chosen names instead of short abbreviating names. Complain about misnaming explicitly. Here is a list of mandatory rules unless there is hard technical evidence that it would break code when refactoring: app -> Application, admin -> administrator / administrate, dep -> dependencies / department, repo -> repository, sync -> synchronization / synchronize, dev -> development / developer, prod -> production / produce, temp / tmp -> temporary, auth -> authentication/ authorization, deploy -> deployment / deploy, cred -> credentials, tmp/temp -> temporary, prep -> prepare, regex -> regular expression, diff -> difference, infra -> infrastructure. This mandatory rule applies to all AI model internal thinking stages, reasoning steps, code comments, planned tasks, todo items, tool invocation parameters, tool descriptions, and user-facing communications. Trying to "save" letters is unprofessional and decreases readability. Code, documentation, internal thoughts, action descriptions, reviews, and suggestions must be completely free of these blacklisted abbreviations unless technically necessary, and must be fully readable as proper, formal technical English text. English contractions (such as "I'm", "I'll", "don't", "can't") are strictly forbidden in all communications, documentation, comments, and thoughts; use full spelling instead (such as "I am", "I will", "do not", "cannot", "must not"), especially elaborated, well-readable, and precise English.
- Language should aim to be less context-dependent. Authentication is something entirely different than authorization, auto could mean automobile or automation, deps could be departments or dependencies. Blacklist such typical incorrect abbreviations, but whitelist very popular context-free acronyms such as OIDC, API, CPU, GPU. Make sure to use correct grammar. They is plural, not singular and must only be used in plural. A company or team or contributor for example is a single abstract entity, so it is definitely not a plural they.
The expectation for the contributor is that he must understand all changes he is proposing as if he had written the changes himself.
- Code is more often read than written and most of the costs come from maintenance.
- What is not tested is not supported. Automation is the best documentation.
- We do trunk-based development in the master branch.
- When referring to Kubernetes fields in prose, spell them out (say "the specification" not "the spec") except where a literal YAML key must stay verbatim.
- We support only Linux.
- And as a reminder to never output incorrect English in any PR creations or reviews, the AI model must not output any English text that is grammatically incorrect, unprofessional, or contains any of the blacklisted abbreviations. The AI model must always output fully readable, formal, and precise English text in all communications, documentation, comments, and internal thoughts.

## Repository structure

- `backend` contains the Python Flask application and its existing tests.
- `frontend` contains the Angular application, Jest tests, and Cypress tests.
- `common/backend` and `common/frontend` contain the repository-owned legacy
  Kubeflow libraries. Follow `common/README.md` for their provenance; these are
  not automatically synchronized with Notebooks.
- `manifests/kustomize` contains the base resources, components, and overlays.
- `.github/workflows` defines formatting, application, image, and cluster checks.

## Architecture

- Gunicorn runs the Flask application with the gevent worker in the production
  image. Runtime dependencies must be installed in the final image, not merely
  present in a builder or development environment.
- The frontend and backend use the local common libraries. Preserve public
  package names and interfaces unless the task explicitly changes them.

The following Community Distribution architecture applies to the integrated
deployment tested by the manifest workflow:

- Every external request enters through the Istio ingress gateway, is authenticated by Dex and OAuth2-Proxy, and is then routed by the Istio service mesh, which also enforces authentication between the components.
- The Central Dashboard aggregates the per-component user interfaces (Pipelines, Katib, Notebooks, Volumes, KServe UI, Model Registry, Trainer) behind that single authenticated entry point.
- The Profile controller projects every user or team into an isolated namespace that carries its own service accounts, role bindings, secrets, Istio authorization policies and persistent volume claims; all workloads (workbenches, pipeline runs, experiments, model serving, distributed training and Spark applications) run inside these namespaces.
- Cert Manager issues the certificates for the admission webhooks that the controllers rely on.

## Testing and continuous integration

- Run `make docker-build` followed by `make docker-smoke-test` with the same
  `IMG` and `TAG`. The smoke test checks runtime dependencies, gevent worker
  loading, and application import inside the built image.
- The manifest workflow reuses the current Kubeflow Community Distribution
  KServe installation and verification scripts. Prepare its application input
  with the pull request manifests and image before installation waits for
  readiness. Follow the namespace expected by those scripts.
- Use the existing frontend checks: formatting, linting, Jest, and Cypress, along
  with the common frontend library checks.
- Keep Black and yamllint versions aligned between continuous integration and
  `.pre-commit-config.yaml`. Run Black on `backend` and `common/backend`,
  yamllint with `.yamllint.yaml`, and ShellCheck on changed shell scripts.
- When adapting Community Distribution workflows, preserve application-specific
  paths and verify changed-file selection rather than copying it blindly.

