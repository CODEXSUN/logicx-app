# LogicX work record

## 2026-11-19 — Ubuntu installation preparation

User authorized publishing and installing 0.1.6 on cx@192.168.1.34, then selected the password for admin@tenant.com from Platform's private local environment. Do not display or commit that credential.

CodeShip verified the existing MariaDB 11.8.9 and reserved LogicX block 4440–4449, private production 14445:4445. It confirmed that the Node application adapter cannot deploy Frappe; this app supplies its Bench-specific adapter while reusing CodeShip's target registry, encrypted vault, release verification/image retrieval and exclusive operation lock. No Platform identity admission is implied; Frappe owns its authentication.

Selected upstream image: official frappe/erpnext v16.60.0, manifest digest recorded in `.container/release.json`; inspected runtime reports Frappe16.60.2, ERPNext16.60.0, Python3.14.10 and Node24.22.3. Frappe's official installation requirements specify MariaDB11.8, Python3.14, Node24 and Redis6+. Primary reference: https://docs.frappe.io/framework/user/en/installation . Own Redis7.4.12 sidecars avoid shared cache flush/queue operations.

Preparation includes immutable image publication, a database-scoped one-shot installer, isolated processes/storage, loopback-only access, secret-safe installation logging, and the updated Frappe icon-install hook. Existing migration/patch files are unchanged.

Verified so far: production React build; version consistency; installer configuration and topology unit checks. Candidate image build, disposable fresh-site integration, tagged workflow/publication and actual Ubuntu installation remain pending. SSH later began refusing connections; reported to CodeShip. No Ubuntu mutation has been performed by this chat at this stage.

## 2026-11-19 — Ubuntu authorization revoked

CodeShip relayed the user's newer instruction to stop Ubuntu deployments and use local Docker only. No further Ubuntu connection, provisioning, migration, image load, credential transfer or automatic resume is authorized. This chat had performed read-only Ubuntu inspection only: no target lock, credentials, database/user, containers or files were created there.

Publication and installation are on hold pending the user's app-specific local-target decision. The 0.1.6 source is still uncommitted and unpublished. An isolated Windows Docker fixture is finishing its final test; it uses only disposable credentials and an unrelated random Compose project, not the existing local infrastructure database. Earlier fixture checks confirmed all three installed apps, both workers, named email login, built assets and the WebSocket proxy. The final fixture additionally verifies the precise ERPNext Item Manager permission required by the product API. Frappe's built-in Administrator login remains separate from the requested email-named manager account.


## 2026-11-20 — Independent PostgreSQL development installer

Fresh user instruction authorizes only a manual local Frappe development installation, using the existing PostgreSQL and Redis services. No additional infrastructure servers, production release/publication, Platform SDK integration, Ubuntu or one-off Docker repairs are part of this task. The user approved pinned upstream development revisions after the v16 ERPNext/PostgreSQL compatibility audit.

The active commands are now `.container/dev.mjs` and the setup/verify wrappers. The default Compose file includes the development definition; the earlier unpublished release definition is retained separately as `compose.release.yml` and is not invoked. The development runtime contains one app container, editable LogicX source, Frappe/ERPNext pinned revisions, developer mode and manual process startup. The initializer does not create a database server, run Redis servers, migrate on restart, or alter framework/application SQL.

Read-only audit verified existing PostgreSQL17.12 and authenticated Redis, with Redis logical DBs10/11 empty. The script reserves only app-owned PostgreSQL database/role logicx_dev and those two Redis logical DBs, with a restricted Redis account and durable ownership markers. Cleanup requires an explicit development confirmation and validates database/role comments, container/volume labels and Redis markers; no shared server/volume or foreign database is removed. Global Redis flush commands are denied. State/error logs are private under ignored `.codeship/development/`; shared operator credentials never enter the app.

Source checks for PostgreSQL configuration, reserved Redis DBs, single-service topology, external network, private bindings and forbidden operator mounts pass. The first build exposed the upstream image's root-group ownership convention; Dockerfile and entrypoint were corrected to frappe:0. No app database/volume was created before that failure. A script-driven clean installation is currently building the pinned runtime; actual site installation and final checks remain pending.


### User stop — 2026-11-20

User requested stopping and resuming later. Stopped the verified Docker build client owned by this LogicX installer before any app-storage provisioning. The installer exited through its failure/finally path; no development state.json existed, so no PostgreSQL database/role, Redis reservation/account, application container or persistent app volume was provisioned by this attempt. Existing services were not stopped or modified. Prepared scripts, source checks and private stage/error logs remain available. No automatic resume or retry is authorized; wait for the user's explicit resume.

### User resume — 2026-11-20

User explicitly resumed the manual local development task. Compilation of the pinned upstream sources succeeded, but image assembly remains slow. The runtime Dockerfile now uses a separate builder stage and copies only Bench and pinned sources, excluding builder download caches. A Windows Docker CLI cancellation had left its buildx plugin running; the maintained installer now stops both clients and provides a narrowly scoped orphan-recovery command. Recovery stopped one matching orphan, and Docker confirmed the old build as cancelled. The current clean-install operation remains in image assembly; no site provisioning is claimed. PostgreSQL/Redis topology checks (four tests) and installer syntax validation pass. Existing infrastructure was not restarted or pruned.

The image build completed. The first fresh-site attempt failed on Redis access for the pre-site `None|` cache prefix; the script now includes that prefix and the upstream persistent-cache invalidation channels. Guarded cleanup passed and retained the existing infrastructure. The second attempt confirmed no Redis denials, then exposed the running Python process not reloading the editable-install .pth file. The initializer now refreshes site-package paths after pip installation. Its configuration tests pass, and a new clean reinstall is in progress. Added an installation-filtered, read-only Redis diagnostic command and HTTP checks for built JavaScript and realtime readiness. Actual site installation remains pending until these checks complete.

The next clean attempt installed Frappe, ERPNext and LogicX successfully on PostgreSQL, created the requested email account, and built the frontend. Startup exposed RQ's required Redis CLIENT LIST permission; the restricted account denied it, so the process supervisor stopped the app and readiness failed. The maintained ACL now allows only that required administrative read command in addition to the existing non-administrative permissions. Added ACL DRYRUN checks for worker commands, cache keys and invalidation channels, with explicit checks that FLUSHALL/FLUSHDB remain denied. Guarded cleanup passed before the next fresh installation. The new account passes those permission checks with no denials. Site/restart verification is still pending; no live-container patch was made.

### Completed local development installation — 2026-11-20

A final clean installation through `.container/dev.mjs reinstall --confirm-clean-development` passed. The generated web command explicitly selects logicx.localhost and binds inside the container to 0.0.0.0; Docker continues to publish only host loopback ports4445/4446. The Redis rules include the Bench-specific scheduler heartbeat prefix, and required-command dry runs pass while global flush commands remain denied.

Verified against actual runtime: PostgreSQL17.12 database/role logicx_dev; Frappe17.0.0-dev; ERPNext17.0.0-dev; LogicX0.1.6; developer mode; all three installed apps; two workers; live scheduler heartbeat and enabled scheduler; admin@tenant.com login using the approved Platform .env password; authenticated LogicX page and product API; built JavaScript asset; realtime Engine.IO handshake. Manual stop followed by manual start passed the same complete verification without any reinitialization/migration. Redis diagnostics show no access denials for this installation. The app remains running in the single logicx-dev container, with the two app-owned volumes and app storage in the existing PostgreSQL/Redis services. No new infrastructure server was created or shared server restarted/pruned. ERPNext company/business setup is intentionally left to the user.

All corrections were made in maintained .container scripts and retried through guarded clean installation; no ad hoc container repair or upstream framework/application SQL patch was used. Source configuration/topology tests, installer syntax checks and Git whitespace checks passed. Source changes remain local and unpublished; no GitHub release or Ubuntu operation was performed. The manual guide records the verified commands and results.

### Read-only navigation performance audit — 2026-11-20

User reported visual lag in LogicX navigation and noted ERPNext's MariaDB heritage. No database switch, configuration change, rebuild, restart, source download or app fix was performed. Current PostgreSQL CPU was2.25%, Redis0.47%, app8.59% at sampling. Across20 direct SQL samples per query, SELECT1 averaged0.27ms(max0.68), product count0.68ms(max5.00), and email lookup0.61ms(max6.61). Fresh Python connection plus first query took544.7ms including lazy client/framework initialization. Authenticated HTTP checks: login549ms; ping21–28ms; LogicX page71–232ms(first232,warm71–74); simple product-list API30–69ms;744731-byte JavaScript25–32ms. All returned200.

An interactive browser check reached the Products page and navigated Products→Planning→Products. Click-to-accessible-state measurements were662ms and566ms, including UI automation/observation overhead; these are not browser frame/render profiling measurements. No prolonged freeze was reproduced. The current product dataset is empty, so these measurements do not establish large-data or worst-case performance. PostgreSQL was not identified as the navigation bottleneck; the user's visual lag remains unisolated. MariaDB remains the established ERPNext deployment path, while this user-approved environment uses pinned PostgreSQL-compatible development revisions. Do not infer that switching databases will fix the reported visual lag from these results.

### General Master for garment manufacturing — 2026-11-20

Implemented a native General Master DocType in the LogicX module with required Type and Name (master_name because Frappe reserves name), optional Description and Tag, and Active defaulting to1. This is site-owned master/reference data. Native Frappe hash IDs, owner/creation/modified actors/timestamps and Version tracking remain authoritative; no Platform/Kysely table or cross-app dependency was introduced. System Manager has Read/Create/Write; Guest is denied. Deactivation preserves references; no permanent-delete UI or fabricated business seed data was added.

Wired Master→General Master into the existing LogicX sidebar with real list, Show, New and Edit routes. The list fetches all REST API batches, supports search, Active/Inactive filtering, sort, column visibility, refresh,100-row pagination and only implemented row actions. The form has header Save/Cancel, Ctrl/Cmd+S, required validation, duplicate-submit prevention, saving/errors and unsaved warnings for Cancel/sidebar/browser unload. Browser Back retains the existing SPA router behavior. Reused the app's existing public @codexsun/ui form/table/shell components rather than modifying its bundled UI source or importing another Platform UI package.

Added maintained migrate-general-master and verify-general-master commands. The migration checked target/DocType ownership, successfully backed up the existing PostgreSQL site (20261120_182448-logicx_localhost-database.sql.gz in the site's private/backups directory), then ran the native Bench migration successfully. No site reset, new server or upstream Frappe source download occurred. Backend create/list/update/deactivate/required-fields/Guest permission checks passed in a rolled-back transaction; no test business data remains. Two frontend contract tests passed for payload allowlisting/boolean conversion and complete-list pagination. Frontend assets built successfully through the existing assets command. Browser verified the Master sidebar, empty list, New form, required-field errors and final readable Active value. Screenshot: ignored .codeship/development/general-master-form.jpg. Syntax and Git whitespace checks passed. Source and operational guide: docs/general-master.md.

### Editable Type select on General Master New/Edit — 2026-11-20

Replaced the Type text input on both New and Edit with the existing public combobox composition, using an optional backward-compatible MasterForm renderField extension. The same input supports opening choices, typing/filtering, mouse/keyboard selection, and a Use “…” option for a new value. Suggestions combine common garment categories, saved distinct type values, and active General Master definitions whose Type is Type (for example Line Name and Machine Type); ordinary master names are not offered as categories. Suggestions are not database seeds. The native Data field and server validation remain unchanged, so no migration/reset was needed. Source data and other forms are preserved.

Frontend assets rebuilt successfully through .container/dev.mjs assets. Three API contract tests pass, including the active Type-definition mapping. The saved-type API returned200 against the local PostgreSQL site. Browser verified saved Singer selection on New, custom Cutting Stage entry retained after Enter and blur, filtering Machine→Machine Type on Edit, and restoring the original value without saving. Test input was discarded; no General Master records were created or changed. Visual verification exposed a narrow popup anchor; corrected the app-owned anchor to the full input width and rebuilt, then confirmed readable options including Line Name and Machine Type. Final screenshot: .codeship/development/general-master-type-select.jpg; the new form is shown to the user. Git whitespace checks passed. No Frappe source download or infrastructure change occurred.

### Type dropdown restricted to table data — 2026-11-20

User clarified that Type choices must come only from the table's Type column. Removed all preset garment options, derivation from master_name/Type-definition rows, and the creatable Use option. New/Edit now share a searchable selection control whose selected value changes only when an existing option is chosen; typed search text does not create a type. The API reads only type and returns distinct stored values, including values on inactive rows because this is the actual Type column inventory. No records or schema were changed.

Updated frontend contract test passes for exact distinct Type values with no record names. All three frontend contract tests and the maintained assets build passed. Browser confirmed the current choices are only Singer and Type; searching Not in table showed No existing types match with no creation option. Search input was cleared without saving. Screenshot: .codeship/development/general-master-saved-types.jpg. The documentation now reflects the corrected selection-only behavior. Existing user records were preserved.

### Line Master — 2026-11-20

Authorized Master addition with required Factory, Floor, Area and Line No; native automatic immutable serial LM-00001. Existing public form/table components and native REST permissions are used for List, Show, New/Edit. Operation routes and permissions: docs/line-master.md. Verification pending.

### General Master terminology refactor — 2026-11-20

Renamed displayed Type→Master Head and Name→Value in General Master DocType metadata, form fields, list headers, read-only details, validation, hints and lookup errors. Refactored the app-owned lookup component to GeneralMasterHead/general-master-head.jsx and its API accessor to heads(). Existing REST/storage fields type and master_name intentionally remain stable to preserve data and external references; native Frappe name is still the immutable record ID. Master Head continues to select only distinct saved column values, without presets or new-value creation.

The maintained migration backed up the site (20261120_190512-logicx_localhost-database.sql.gz), synchronized the new labels, and compared all six business/identity fields before and after; all four existing records were identical. Extended backend verification checks the new metadata labels; create/read/update/deactivate/required-field/guest-denial checks passed with temporary data rolled back. All three frontend contract tests and the assets build passed. Browser verified the list and New form show Master Head/Value and retained four records. Opened the General Master list for the user and captured .codeship/development/general-master-head-value.jpg. No General Master data, infrastructure, unrelated module or upstream source was changed/downloaded by this task. Other workspace changes, including Line Master, were preserved.

### Stable Overview menu — 2026-11-20

Replaced the route-dependent top sidebar action (duplicate General Master / Add product) with a stable Overview action and dashboard icon. It uses guarded navigation to the existing app home route; General Master and Line Master remain under Master. Existing home destination remains Products.

### Master table spacing and header cleanup — 2026-11-20

Added responsive horizontal padding (16px, 24px from small screens) and vertical spacing around General Master and Line Master list content, including toolbar and pagination. Removed their Refresh toolbar buttons; error Retry remains. Disabled the existing shell workspace-title header option to remove the right-side LogicX workspace label. No shared UI implementation or data changes.

### Responsive master lists — 2026-11-20

Removed forced full-height content that overflowed below the app header. Scoped master table layout to available width with wrapping values/headers; at mobile widths records become two-column labelled cards with all selected fields and row actions retained. Labels travel with their columns when reordered or hidden. Existing vertical scrolling remains available for longer lists. Build validation pending.

### 20 November 2026 — Shared entry form redesign

Implemented a single-column shared entry card and reusable searchable lookup drawer for the bundled form controls, including General Master heads. Added Enter-to-next-field navigation, lookup selection focus, Escape return focus, and header Save targeting. Retained existing-only Master Head options and existing data/storage fields. Rebuilt local assets using `.container/dev.mjs assets`; build passed. Browser checks verified existing-head search/selection, the complete field-to-Save Enter sequence, and Escape focus restoration without creating records. Existing General Master contract tests passed; whitespace checks passed. No database migration required.

### 20 November 2026 — General Master column order

Moved Master Head before Value in the General Master table; all remaining columns and record behavior are unchanged. Local assets rebuilt through the maintained container script.

### 20 November 2026 — Type-based master head lookup and list return

Master Head suggestions now use distinct Values under a trimmed, case-insensitive Type head. Added opt-in custom input to the shared drawer for General Master only. Save returns to list, Value opens Edit, View action removed, and old Show URLs redirect to list. API contract tests (3) and local asset build passed. Browser verified Type suggestions and custom-head selection without saving preview data. No schema migration.

### 20 November 2026 — Combined General Master workspace

Added a separate menu and route combining a left data list, middle create/edit form, and persistent right lookup search. Existing standalone pages retained. Initial focus and successful-save reset focus target Master Head; save updates the list and clears the form for the next entry. Local container asset build and three API contract tests passed. Browser verified selecting an existing record and saving unchanged business values, list refresh, new-entry reset, and first-input focus. Opened the page as the user-facing result. No schema changes or new records.

### 20 November 2026 — Compact combined workspace

Removed the combined-page New and form Save/Cancel buttons; retained only breadcrumb Save. Shortened breadcrumb to Master and hid its app identity. Matched panel headers to 48px, removed helper copy, and transferred Master Head focus to the side lookup input. Local asset build and whitespace checks passed; browser confirmed one Save action, compact headers, and search focus on load and on Master Head click. No record changes.

### 20 November 2026 — Input-driven lookup

Removed the separate right search input. Master Head retains focus and filters the result list as typed; Up/Down changes selection and Enter applies it then focuses Value. Custom heads remain selectable. Initial and after-save focus now stays in Master Head. Local asset build and whitespace checks passed. Browser verified Line filtering, Down selecting Line Name, and Enter advancing to Value; cleared preview without saving records.

### 20 November 2026 — Focus-controlled floating lookup

Replaced the persistent search column with a floating Master Head result drawer. It opens on Master Head focus, retains live keyboard lookup, and closes on blur or Escape. Value has no lookup drawer. The main canvas now has list and form columns. Container asset build and whitespace checks passed; browser verified Master Head opening, Tab to Value hiding, and refocus reopening. No data changes.

### 20 November 2026 — Existing-only Master Head selection

Removed custom Use options from combined and standalone Master Head lookup. Combined Save rejects heads outside existing Type Values while preserving unchanged legacy record heads. Typing remains a live filter. Local container asset build and whitespace checks passed; no data changes.

### Breadcrumb identity cleanup — 2026-11-20

Disabled the existing showApplicationIdentity shell option for all LogicX application headers, removing the duplicate logo and app name beside breadcrumbs on list, New, Edit and Show screens. Main application branding remains in the top bar.

### 20 November 2026 — Standard upsert floating lookup

Applied the input-driven Master Head drawer to standard General Master New/Edit pages, retaining the normal list and save-to-list flow. Added initial focus, existing-head validation and compact left-aligned form with reserved drawer space. Rendered drawer through a portal to avoid shared field child-width styling. Asset build and three contract tests passed. Browser verified live filter, keyboard selection to Value, corrected narrow drawer width, and blur dismissal. No test records saved.


### 23 November 2026 — Final pending-source closure under job freeze

The human requested publication of reviewed pending source, without new jobs or deployment. The remaining development and release prototype scripts/configuration, supporting tests, README/setup notes and historical work record are included as source. They are not certified deployment-ready. The current image is absent locally; no image was built/pulled, no tag was created, and no installer, migration, cleanup, server or Platform operation was executed.

Closure verification passed: pending Python/JSON/JavaScript/shell syntax, seven Node tests, four Python tests, remote-ops MCP checks/four tests, release contract, version consistency and credential-pattern review. Frontend source is unchanged since its passing build. The repository helper's Git functions publish an explicit reviewed path list; generated/private files stay ignored. Version remains 0.1.6 because this closes its existing pending preparation rather than starting another release. New jobs remain frozen after publication.
