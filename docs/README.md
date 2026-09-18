# Project documentation

Start with the [root README](../README.md) for a quick local run. This folder is the source of truth for the current **v2 workspace**; the original hackathon slides/video at the repository root describe an earlier version.

| Document                                          | What it covers                                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [Architecture](ARCHITECTURE.md)                   | Request flow, agents, storage decision, safety boundaries, performance             |
| [Configuration](CONFIGURATION.md)                 | Every runtime setting, demo/cloud modes, HTTPS preview cookies                     |
| [API](API.md)                                     | Sessions, CSRF, CRUD, pagination, concurrency, assistant confirmation              |
| [OpenAPI JSON](openapi.json)                      | Generated, machine-readable request/response contract                              |
| [Development](DEVELOPMENT.md)                     | Linux/macOS/Windows setup, tests, formatting, dependency updates                   |
| [Deployment](DEPLOYMENT.md)                       | Containers, PostgreSQL, Google Cloud Run, IAM, Secret Manager                      |
| [Operations](OPERATIONS.md)                       | Health checks, logs, backups, retention, analytics, incident handling              |
| [Migration](MIGRATION.md)                         | Moving v1 workspace data without reusing compromised authentication material       |
| [Security](SECURITY.md)                           | Threat model, controls, privacy, disclosure, limitations                           |
| [Testing](TESTING.md)                             | Coverage, reproducible commands, browser/accessibility checks, what was not tested |
| [Audit and roadmap](AUDIT_AND_ROADMAP.md)         | Findings fixed, trade-offs, outstanding production gates                           |
| [Changelog](CHANGELOG.md)                         | User-visible changes and breaking API/storage changes                              |
| [Demo screenshots](assets/workspace-desktop.webp) | Actual desktop/mobile UI captures using private sample data                        |
| [Third-party notices](THIRD_PARTY_NOTICES.md)     | Project license boundary and font attribution                                      |

Documentation accompanies the code; it is not a claim that a particular Google Cloud deployment has been provisioned, load-tested, or independently security-audited.
