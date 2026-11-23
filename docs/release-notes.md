# LogicX 0.1.6 release prototype

Status at source closure (23 November 2026): source only, not a certified or published image release. The configured local image `ghcr.io/codexsun/logicx-app:v-0.1.6` is absent. Candidate image build, disposable integration and tagged publication must pass before this release path is used. No build, tag, deployment or server mutation is authorized by publishing these files. Existing Ubuntu deployment authorization remains revoked; any future target and timing need separate approval. References below describe the intended prototype behavior, not completed deployment evidence.

LogicX 0.1.6 prepares a fresh, private Ubuntu installation with Frappe 16.60.2 and ERPNext 16.60.0 from a pinned official image.

- Builds the React interface into the image; source code and dependencies are not downloaded at runtime.
- Uses the existing MariaDB 11.8 service with a dedicated LogicX database and account. The one-shot installer has no database root credentials.
- Runs separate backend, frontend, WebSocket, worker and scheduler services, plus app-isolated Redis cache and queue services.
- Publishes only loopback port 14445. Persistent sites, private files, logs and queue state belong to this stack.
- Stores approved administrator and generated service credentials in CodeShip's encrypted Ubuntu registry. Installation files are private and removed after success.
- Provisions the explicitly requested `admin@tenant.com` login with System Manager and Item Manager roles for LogicX products and their ERPNext Items. Frappe's built-in `Administrator` account uses the same approved password; its account name remains unchanged.
- Disables the development Git-update controls in managed release containers. Restarts do not initialize or migrate the site.
- Supports fresh setup and verification only; existing sites and databases require explicit recovery review. Future upgrades require backup and migration support.

The earlier development container remains available through `.container/compose.dev.yml` and `Dockerfile-frappe`; it is not the Ubuntu release deployment path.
