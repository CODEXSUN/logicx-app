# General Master

General Master owns reusable garment-manufacturing reference values within the current Frappe site. It is independent of Platform and uses native Frappe DocType identifiers, permissions, owner/creation/modified audit fields and change history. No Kysely schema, parallel table or separate server is introduced.

| Label | DocType field | Rule |
| --- | --- | --- |
| Master Head | `type` | Required category; previous display label was Type |
| Value | `master_name` | Required value; previous display label was Name |
| Description | `description` | Optional plain text |
| Active | `active` | Boolean, enabled by default |
| Tag | `tag` | Optional text |

On New and Edit, Master Head search lists distinct Values from records whose Master Head is Type (case-insensitive, ignoring surrounding spaces). Users may select a suggested Value or type and use a new head. This does not create a separate Type record automatically. Save returns to the list; Value links open Edit and there is no read-only Show page. Legacy Show URLs redirect to the list. Storage/API field names remain unchanged.

The **Master → General Master** sidebar opens `/logicx-app/general-masters`. The list loads all Frappe API batches and supports search, Active/Inactive filtering, column visibility, sorting, pagination, refresh, View, Edit and Deactivate. Deactivation preserves the record; edit can reactivate it. There is no permanent-delete action. No master categories or manufacturing records are seeded.

| Operation | Browser route | Frappe REST API | Permission |
| --- | --- | --- | --- |
| List | `/general-masters` | GET `/api/resource/General Master` | Read |
| Create | `/general-masters/new` | POST `/api/resource/General Master` | Create |
| Edit / deactivate | `/general-masters/{name}/edit` | PUT `/api/resource/General Master/{name}` | Write |

The DocType grants Read/Create/Write to System Manager; Frappe enforces these permissions on every API operation. Guest has no access. New/Edit use header Save and Cancel, Ctrl/Cmd+S, required-field checks, duplicate-submit prevention, save errors, and unsaved-change warnings for Cancel, sidebar navigation and browser unload.  Browser Back within the SPA follows the existing router behavior.

Run from this app checkout:

```powershell
node .container/dev.mjs migrate-general-master
node .container/dev.mjs verify-general-master
node .container/dev.mjs assets
node --test tests/general-master.test.mjs
```

Migration verifies site/DocType ownership, creates a native database backup in the site's private backups directory, and invokes the explicit Frappe migration command. It neither reinstalls the site nor fetches upstream source. Verification exercises creation, listing, update, deactivation, required fields and guest denial, then rolls back its temporary records. Frontend contract tests cover boolean payloads, field allowlisting and complete-list pagination.

Entry forms use the bundled shared single-column card layout. All shared form lookup/select controls open the same searchable right drawer. Selecting an option focuses the next field; Enter advances through fields, Enter on an empty lookup opens search, Arrow Down opens a selected lookup, and Shift+Enter inserts a description newline. The final field advances to header Save without submitting. Escape closes search and restores its trigger. Master Head supports suggestions under Type and typed custom heads. This presentation change requires an asset build only, with no database migration.

The separate Master → General Master Workspace page (/logicx-app/general-masters/workspace) combines the data list, entry form, and lookup search in three columns on desktop, stacking on narrower screens. Select a Value at left to edit; New clears the form after an unsaved-change check. Master Head and Active use the persistent right search panel. Successful Save refreshes the local list, resets to a new entry, and focuses Master Head. The existing standalone list and form routes remain available.

The combined workspace uses one Save action in the breadcrumb header. Panel headers share a compact 48px height; field and keyboard helper copy is hidden in this view. Master Head retains input focus, including on load and after save. Typing filters the persistent right-hand result list live; Up/Down changes the highlighted result and Enter selects it and advances to Value. A typed new head remains available as a Use option. There is no separate lookup search input. The combined page hides breadcrumb app identity and uses the short Master title.

Master Head results now appear in a floating nonmodal drawer only while that field is focused. Moving to Value or another control hides it; typing, Up/Down and Enter retain the live lookup behavior. Escape also closes the drawer. The data list and entry form occupy the main two-column workspace.

Master Head now permits existing suggestions only. Typing filters Values under Type; the custom Use option has been removed in both General Master entry views. The combined form rejects unsuggested new heads on save while allowing an unchanged existing record head to be preserved.

The standard General Master New/Edit pages now use the same input-driven floating Master Head drawer: initial field focus opens suggestions, typing filters existing Type Values, arrows/Enter select, and blur to Value hides results. The compact form sits left with desktop space reserved for the drawer; save still returns to the standard list. Both new entry and changed heads must match an existing suggestion, while unchanged legacy heads may be preserved.
