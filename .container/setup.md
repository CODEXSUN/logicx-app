# Manual local Frappe development installation

This is an independent Frappe/ERPNext/LogicX development environment, not a Platform SDK consumer or a production release deployment. Use only the commands below from the repository root. Node 26 and Docker Desktop `desktop-linux` must already be available.

## Existing infrastructure

The script reuses `codebiz-infra-postgres-1` (PostgreSQL 17, internal `postgres:5432`) and `codebiz-infra-redis-1` (`redis:6379`) on the existing external `codebiz-infra_default` network. It never creates or restarts infrastructure services. Redis maintenance credentials come from CodeShip's existing encrypted local registry; PostgreSQL maintenance authentication stays inside its existing container.

One new application container, `logicx-dev`, is installed. It owns PostgreSQL database/role `logicx_dev`, Redis logical DBs 10 (cache) and 11 (queue), a restricted named Redis user, and volumes `logicx_dev_bench` and `logicx_dev_frontend_modules`. These are app storage within the existing servers, not new database/Redis servers. DBs 10 and 11 must be empty before first installation. Owner markers and the recorded installation ID protect cleanup.

The upstream development commits and base-image digest are fixed in `dev-versions.json`. PostgreSQL support is developmental; no production compatibility is claimed. LogicX currently requires ERPNext's Item DocType, so both upstream apps are installed. No upstream SQL or framework source is patched by this installer.

## Manual commands

```powershell
node .container/dev.mjs audit
node .container/dev.mjs setup
node .container/dev.mjs verify
node .container/dev.mjs stop
node .container/dev.mjs start
node .container/dev.mjs assets
```

To pause an active image build, run `node .container/dev.mjs cancel-build` in a second terminal. This stops only this installer's Docker/buildx clients and prevents later provisioning. If a previous interrupted Windows client left its buildx child orphaned, `node .container/dev.mjs recover-build` stops only the orphan matching this pinned LogicX image. Neither command restarts Docker or prunes shared build caches. Docker may need time to finish cancelling its current image operation.

`setup` audits, builds, provisions only owned app storage, installs the site, starts it, and verifies it. It refuses existing/partial installations rather than overwriting them. `start` never installs or migrates. Python source is editable through the mounted checkout; `assets` explicitly rebuilds the React interface. No watcher, automatic Git pull, deployment, or retry is enabled.

Visit `http://logicx.localhost:4445/logicx-app` (or `http://127.0.0.1:4445/logicx-app`). WebSockets use loopback port 4446. Sign in as `admin@tenant.com` using the previously approved password from Platform's private `.env`. This is a separate Frappe account, not shared Platform authentication. The required Frappe Administrator account uses the same approved password. Complete ERPNext's company/business setup yourself; the script does not invent company data.

The app is installed in developer mode. Frappe, realtime, scheduler and both workers run within the single development container. Redis servers are not started by Bench.

## Failure, cleanup and clean reinstall

Fix the maintained scripts, then explicitly run:

```powershell
node .container/dev.mjs reinstall --confirm-clean-development
```

For cleanup only:

```powershell
node .container/dev.mjs clean --confirm-clean-development
```

These commands permanently delete this recorded development site's database, queue/cache data and two app volumes. They validate container/volume installation labels, PostgreSQL owner comments and Redis reservation markers first. Unknown or changed ownership stops cleanup. Shared servers, shared volumes, other databases, other Redis DB numbers, source files and unrelated containers are retained. Redis FLUSHALL/FLUSHDB are never used. A clean reinstall is a manual destructive action, never an automatic retry.

Private configuration, state, error output and stage history live under ignored `.codeship/development/`, protected for the current Windows account. Infrastructure passwords are never mounted into the application. All mutating commands take CodeShip's existing exclusive operator lock; another owner's lock is never removed. Read failure logs privately because upstream exceptions may include data.

`node .container/dev.mjs diagnose` checks required Redis permissions and reads access failures for this installation's account only, without changing Redis or printing credentials. The required-command checks also run during setup before site creation. Redis `CLIENT LIST` is allowed because the RQ workers require it; global flush and other administration commands remain denied. Use diagnostics to identify a missing key/channel permission before correcting the maintained installer and running a clean reinstall.

Diagnostics also report connection/wait states for `logicx_dev` in PostgreSQL, without query text or application data. Verification checks the connected PostgreSQL server and role, the scheduler heartbeat, both workers, email login, the LogicX API/page, built JavaScript and the realtime endpoint.

The earlier unpublished release/Ubuntu prototypes are not used by this development entry point. Ubuntu remains stopped. No GitHub publication is part of this manual installation.

## Verified local installation — 20 November 2026

The clean script-driven installation passed on the existing PostgreSQL 17.12 and Redis services with Frappe/ERPNext 17 development revisions and LogicX 0.1.6. Verification passed for the connected database/role, all three installed apps, two workers, scheduler heartbeat, requested email login, LogicX page/API, JavaScript asset and realtime endpoint. Manual stop/start passed the same checks without reinstalling or migrating. The development app is running on the loopback ports above; ERPNext company/business setup remains manual.
