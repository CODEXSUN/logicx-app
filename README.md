# LogicX

LogicX is a Frappe application foundation for building a custom business system on top of ERPNext.

The application contains no storefront, payment integration, cart, checkout, order, or fulfillment module.
It provides one `LogicX Product` DocType linked one-to-one with the ERPNext `Item` DocType.

The `/logicx-app` administration interface uses React, Vite, and a local CSS surface.
It includes a product overview, product management, responsive navigation, and Frappe session actions.

## Requirements

- Frappe Framework
- ERPNext

## Install

From a Frappe Bench directory:

```bash
bench get-app logicx_app https://github.com/CODEXSUN/logicx-app.git
bench --site <site-name> install-app logicx_app
```

ERPNext must already be installed on the target site.

The internal app name is `logicx_app`; hyphens are not valid in a Python/Frappe package name.

## Migrate and upgrade

```bash
bench --site <site-name> migrate
bench update --apps logicx_app
```

Future schema migrations can be registered in `logicx_app/patches.txt`. Runtime hooks belong in
`logicx_app/hooks.py`.

## Version and release tools

Show and validate the current version:

```bash
npm run version:show
npm run check:versions
```

Create the next patch version and changelog section:

```bash
npm run version:bump -- --title "Version title" --no-database-update
```

Use `--database-update` when the release changes a DocType, patch, or database contract.

Preview the GitHub release workflow without changing files or Git history:

```bash
npm run github:now -- --dry-run
```

The same Python release tools are available as native Bench commands:

```bash
bench --site <site-name> logicx-release show
bench --site <site-name> logicx-release check
bench --site <site-name> logicx-release bump --title "Version title" --no-database-update
bench --site <site-name> logicx-release github-now --dry-run
```

The interactive command reviews the version and commit subject before pull, stage, commit, and push.
The release history is in [`docs/changelog.md`](docs/changelog.md).

## Live updates

In **Agentic Coding → Updates and maintenance**, Administrator can check for and apply a Git update,
or migrate and build the current checkout. Git updates require a clean checkout on a tracked branch
that can fast-forward.

The background job installs the locked frontend dependencies, runs site migrations, builds the app
assets, and clears the site cache. The panel shows progress and offers a reload when the job finishes.

## Current domain model

`LogicX Product` is the only custom DocType. It adds a small e-commerce projection over an ERPNext
`Item` while keeping ERPNext as the source of truth for the item name and item group.

## License

MIT

## Planning and agent chat

Open **Planning** or **Agentic Coding** from the LogicX sidebar. Planning covers the garment workflow from
fabric receipt through dispatch. Agentic Coding requires the Frappe Administrator account and drafts
implementation and test plans from the context supplied in chat. It does not edit the checkout or run commands.

Set `OPENAI_API_KEY` and `LOGICX_OPENAI_MODEL` in the Frappe web process environment, or use the private
Frappe site configuration keys `logicx_openai_api_key` and `logicx_openai_model`. Allow outbound HTTPS to
`api.openai.com`. The server sends the recent chat turns to the provider. Conversations live in the active
page and reset when leaving the workspace.
