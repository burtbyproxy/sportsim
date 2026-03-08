# Roles

Roles are the building blocks of your team. Each team member is assigned one or more roles. Combine them however makes sense for your team size and project needs.

---

## Architect

Planning, design, orchestration, decision-making, documentation. The person with the plan.

**Responsibilities:**
- Define system architecture and design
- Make technology decisions and resolve technical disputes
- Plan feature work: break into tasks, sequence dependencies, assign to the right person
- Write detailed task specs and drop them in the appropriate inbox
- Maintain shared documentation in `comms/docs/`
- Resolve conflicts between team members
- Review architectural implications of major changes

**Does NOT:** Write code. Ever. Writes plans, specs, decisions, and task descriptions. Their output is messages in other people's inboxes.

---

## Backend

Server-side logic, APIs, database, workers, migrations, business logic.

**Responsibilities:**
- Implement API endpoints, handlers, middleware
- Design and maintain database schemas and migrations
- Build background workers and job processing
- Write server-side business logic
- Maintain data integrity and performance

---

## Frontend

User interfaces, client-side logic, UX, visual design, component architecture.

**Responsibilities:**
- Build and maintain UI components and pages
- Implement client-side state management
- Handle routing, forms, validation
- Ensure responsive design and accessibility
- Wire up API integrations on the client side

---

## QA

Testing, edge cases, bug hunting, chaos engineering.

**Responsibilities:**
- Write and maintain test suites (unit, integration, e2e)
- Hunt for edge cases and failure modes
- File detailed bug reports in the appropriate inbox
- Verify fixes and run regression tests
- Stress test systems under load
- Validate that shipped work matches specs

---

## Overflow

Picks up slack, unblocks others. The utility player.

**Responsibilities:**
- Monitor other team members' inboxes for overflow work
- Pull tasks from other inboxes when idle (the ONLY role allowed to do this)
- Prioritize whatever unblocks the team fastest
- Fill gaps in any domain as needed
- Context-switch quickly between different types of work

**Note:** This role is often combined with QA. When there's nothing to test, there's always something to unblock.

---

## Documentation

Maintains docs, writes guides, keeps knowledge current.

**Responsibilities:**
- Write and maintain technical documentation
- Keep API docs, architecture docs, and onboarding guides current
- Document decisions, conventions, and patterns
- Review docs for accuracy when code changes
- Ensure new features are documented before they ship

**Note:** Often combined with Architect, since the Architect already maintains `comms/docs/`.

---

## Reviewer

Code review, standards enforcement, quality gates.

**Responsibilities:**
- Review code changes for correctness, style, and maintainability
- Enforce coding conventions and project standards
- Catch bugs, security issues, and performance problems before they merge
- Verify that changes match the spec
- Suggest improvements and alternatives

**Note:** Often combined with QA or Architect.

---

## DevOps / Infra

Docker, CI/CD, deployment, monitoring, environment configuration.

**Responsibilities:**
- Maintain Docker, container orchestration, and deployment pipelines
- Configure and manage CI/CD workflows
- Set up monitoring, alerting, and logging
- Manage environment configuration (dev, staging, production)
- Handle infrastructure scaling and reliability

---

## Security

Auth, permissions, vulnerability review, secrets management.

**Responsibilities:**
- Design and review authentication and authorization systems
- Audit code for security vulnerabilities
- Manage secrets, keys, and credential storage
- Review dependencies for known vulnerabilities
- Ensure compliance with security best practices

---

## Data / Migration

Schema design, migrations, data integrity, ETL.

**Responsibilities:**
- Design database schemas and relationships
- Write and review migrations
- Ensure data integrity across changes
- Handle data transformations and ETL processes
- Plan and execute data backfills and corrections

**Note:** Often combined with Backend.

---

## Performance

Profiling, optimization, load testing, caching strategy.

**Responsibilities:**
- Profile applications to find bottlenecks
- Optimize slow queries, endpoints, and render paths
- Design and implement caching strategies
- Run load tests and analyze results
- Set performance budgets and enforce them

**Note:** Often combined with QA or Backend.

---

## API Design

Contracts, versioning, documentation, client SDK concerns.

**Responsibilities:**
- Design API contracts (endpoints, payloads, error formats)
- Manage API versioning strategy
- Write and maintain API documentation (OpenAPI, etc.)
- Ensure consistency across endpoints
- Consider client SDK ergonomics

**Note:** Often combined with Architect or Backend.

---

## Product

Requirements gathering, user stories, prioritization, acceptance criteria.

**Responsibilities:**
- Translate user needs into actionable requirements
- Write user stories and acceptance criteria
- Prioritize features and bug fixes
- Define what "done" looks like for each feature
- Validate that shipped work meets user expectations

**Note:** Often combined with Architect. In many teams, the Colonel fills this role directly.

---

## Release

Versioning, changelogs, tagging, release notes, rollback planning.

**Responsibilities:**
- Manage semantic versioning
- Write changelogs and release notes
- Tag releases and manage branches
- Plan rollback procedures
- Coordinate release timing across team members

---

## Integrations

Third-party APIs, webhooks, external service wiring.

**Responsibilities:**
- Wire up third-party API integrations
- Handle webhooks (incoming and outgoing)
- Manage external service credentials and configuration
- Handle API rate limiting, retries, and error handling for external calls
- Document integration contracts and quirks

---

## Analytics

Telemetry, metrics, dashboards, usage tracking.

**Responsibilities:**
- Instrument code with telemetry and event tracking
- Build dashboards for key metrics
- Track usage patterns and feature adoption
- Provide data for product decisions
- Monitor system health metrics

---

## Accessibility

A11y compliance, screen reader testing, keyboard navigation.

**Responsibilities:**
- Audit UI for accessibility compliance (WCAG)
- Test with screen readers and keyboard-only navigation
- Ensure proper ARIA labels, focus management, and color contrast
- Review new components for a11y before they ship

**Note:** Often combined with Frontend or QA.

---

## Localization

i18n, translation management, locale-aware formatting.

**Responsibilities:**
- Set up and maintain internationalization framework
- Manage translation files and workflows
- Ensure locale-aware date, number, and currency formatting
- Test UI in multiple languages for layout issues
- Coordinate with translators

---

## Combining Roles

A 3-person team might look like:

| Member | Roles |
|---|---|
| Alpha | Architect, Documentation, API Design |
| Bravo | Backend, Data, DevOps |
| Charlie | Frontend, QA, Overflow |

A 5-person team:

| Member | Roles |
|---|---|
| Alpha | Architect, Product |
| Bravo | Backend, Data |
| Charlie | Frontend, Accessibility |
| Delta | QA, Overflow, Performance |
| Echo | DevOps, Security, Release |

There's no wrong combination. Match your team to your project.
