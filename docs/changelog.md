# LogicX Changelog

## Version State

Current version: 0.1.6

Release tag: v-0.1.6

Changelog label: v 0.1.6

## v-0.1.6

### [v 0.1.6] 2026-11-23 - Garment masters and development preparation

#### Database Changes

- General Master and Line Master DocType definitions are included in source. Applying them to a site requires its separately approved migration; this publication runs no database changes.

#### App Codebase Changes

- Added the running app name/version at the status bar bottom right, generated from the canonical root manifest; extended version checks for current changelog and generated frontend metadata. This does not represent the latest published GitHub release.
- General Master list, New/Edit and combined workspace support Master Head/Value records, existing-head live filtering and a focus-controlled floating lookup drawer.
- Line Master source and shared single-column entry/keyboard behavior are included.
- Updated the install hook for old/new Frappe desktop-icon helpers and disabled source-update/release commands when an installation explicitly declares managed-release mode.
- Preserved the existing login-button visual feedback change without changing authentication behavior.
- Synchronized Python and package/lockfile versions at 0.1.6; no dependency versions changed.

#### Verification and Publication State

- Frontend build and four master API tests passed during source closure. The final freeze check passed seven Node tests, four Python tests and version consistency.
- This is a source publication, not a tagged image release or deployment. No v-0.1.6 tag, image publication, site installation, data cleanup or server change is performed by this closure.
- Earlier container/deployment prototypes and their related documents/tests are published as explicitly unverified source pending owner review and separately authorized release-image/integration verification. They are not certified production-ready by this changelog.

## v-0.1.5

### [v 0.1.5] 2026-11-19 6:31 pm - Document VPS deployment prerequisites

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped the LogicX version to 0.1.5.

#### Deployment Notes

- The development stack was verified with Frappe 16.36.1 and ERPNext 16.37.0. Newer Frappe releases removed a helper used by the LogicX install hook.
- Production deployment needs a Linux VPS, a DNS hostname, HTTPS, persistent storage, and database backups. Keep MariaDB and Redis on a private network.
- Live agent chat requires an OpenAI API key and model configured on the Frappe server.
- The frontend Git update pipeline was verified on a temporary local branch in development.

## v-0.1.4

### [v 0.1.4] 2026-11-19 3:28 pm - Planning, agent chat, and workspace maintenance

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Added Planning for the garments workflow from fabric receipt and inspection through dispatch.
- Added Agentic Coding for Administrator review of implementation and test plans.
- Added collapsible agent chat backed by Frappe and the OpenAI Responses API.
- Added Administrator controls to check for Git updates or migrate and build the current checkout.
- The maintenance job installs locked frontend dependencies, runs site migrations, builds assets, and clears the cache.
- Updated the version checker to use package manifests, the frontend lockfile, Python metadata, and the changelog.

#### Verification

- Verified **Update from Git** end to end from the Agentic Coding page on a temporary local branch.
- The browser detected an available commit and showed completion after the fast-forward pull, locked dependency install, site migration, asset build, and cache clear.
- **Reload LogicX** reopened the Agentic Coding page after the update.

## v-0.1.3

### [v 0.1.3] 2026-09-26 - Master List v3 row actions

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped the LogicX version to 0.1.3.
- Moved list pagination controls to the bottom footer.
- Added Edit, Suspend, and Force drop actions to product row menus.
- Connected Suspend to the LogicX Product enabled state.
- Added a confirmation dialog before Force drop deletes a product.
- Kept product filters inside the Master List v3 table.

## v-0.1.2

### [v 0.1.2] 2026-09-25 - Product header actions

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Bumped the LogicX version to 0.1.2.
- Replaced the LogicX workspace header identity with product page titles.
- Added product create and edit actions to the application header.
- Kept the Master List v3 product workspace at full width and height.

## v-0.1.1

### [v 0.1.1] 2026-09-25 - LogicX workspace UI

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Added the copied shared UI layout to the LogicX React frontend.
- Added the Master List v3 desk list for LogicX products.
- Added a Save button to the product application header.
- Connected header Save to product form validation and API submission.
- Added workspace scrolling for long product forms.
- Updated the LogicX application and Desk logos.
- Added local Frappe and MariaDB container setup notes and fixes.

### [v 0.1.1] 2026-08-07 1:17 am - ERPNext search and notifications

#### Database Changes

- Database update: No (manual).

#### App Codebase Changes

- Bumped the LogicX version to 0.1.1.
- Connected the top-bar search to the permission-aware ERPNext global search index.
- Added the Ctrl+K search palette with keyboard navigation and direct Desk record links.
- Connected the top notification menu to Frappe Notification Log data and read actions.
- Added a pulsing red indicator when unread notifications are available.
- Removed the Add user action from the user profile menu.
- Replaced the JavaScript release helpers with shared Python release tools.
- Added the native `bench --site <site-name> logicx-release` command group.
- Added Git handling for Windows-owned repositories mounted inside the Bench container.

## v-0.1.0

### [v 0.1.0] 2026-08-07 1:03 am - Frontend live update control

#### Database Changes

- Database update: No.

#### App Codebase Changes

- Added an Administrator-only update status and update API.
- Added a guarded background job for Git pull, migration, asset build, and cache clear.
- Blocked automatic updates when the app checkout contains local changes.
- Added a compact update control beside the sidebar version.
- Added progress polling and browser reload after a successful update.

### [v 0.1.0] 2026-08-07 - LogicX foundation

#### Database Changes

- Database update: Yes.
- Added the LogicX Product DocType with an ERPNext Item link.
- Added catalog fields for publishing, organization, media, pricing, stock, variants, and highlights.

#### App Codebase Changes

- Replaced the original storefront with a focused Frappe and ERPNext product application.
- Added atomic creation for a new ERPNext Item and its linked LogicX Product.
- Added a link flow that keeps an existing ERPNext Item unchanged.
- Added the LogicX Desk workspace, application logo, navigation shell, and collapsible sidebar.
- Added the Tailwind CSS 4 and shadcn-neutral interface.
- Added compact product rows, status filters, image handling, and action menus.
- Added local Compose setup, migration, build, cache, and integration test instructions.
