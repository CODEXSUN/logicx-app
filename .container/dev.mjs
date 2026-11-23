import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';
import { validateDevelopmentCompose } from './dev-policy.mjs';

const root = path.resolve(import.meta.dirname, '..');
const operator = path.resolve(root, '../../devkit/codeship');
const directory = path.join(root, '.codeship/development');
const stateFile = path.join(directory, 'state.json');
const versions = JSON.parse(readFileSync(path.join(import.meta.dirname, 'dev-versions.json')));
const image = 'logicx-dev-runtime:' + versions.frappe.slice(0, 12) + '-' + versions.erpnext.slice(0, 12);
const owner = 'apps/logicx-app';
const marker = '__logicx_dev_owner__';
const volumes = ['logicx_dev_bench', 'logicx_dev_frontend_modules'];
const [command, confirmation] = process.argv.slice(2);
const commands = ['audit', 'diagnose', 'build', 'cancel-build', 'recover-build', 'setup', 'start', 'stop', 'verify', 'assets', 'migrate-general-master', 'verify-general-master', 'migrate-line-master', 'verify-line-master', 'clean', 'reinstall'];

if (!commands.includes(command) || process.argv.length > 4) {
    throw Error('Use node .container/dev.mjs ' + commands.join('|'));
}
if (['clean', 'reinstall'].includes(command) && confirmation !== '--confirm-clean-development') {
    throw Error('Clean/reinstall deletes this recorded development site only. Add --confirm-clean-development.');
}
if (!['clean', 'reinstall'].includes(command) && confirmation) {
    throw Error('This command takes no extra arguments');
}

let state = existsSync(stateFile) ? JSON.parse(await readFile(stateFile)) : null;
let phase = command;
let redisAdmin;
let redisUsername;
let aclFile;
let activeOperation = null;
const cancelFile = path.join(directory, 'cancel.requested');

function cancellationRequested() {
    return activeOperation && existsSync(cancelFile) && readFileSync(cancelFile, 'utf8') === activeOperation;
}

function execute(program, args, options = {}) {
    if (cancellationRequested()) throw Error('Development operation cancelled before the next step');
    try {
        const result = execFileSync(program, args, {
            cwd: root,
            windowsHide: true,
            encoding: 'utf8',
            timeout: 3_600_000,
            maxBuffer: 64 * 1024 * 1024,
            stdio: ['pipe', 'pipe', 'pipe'],
            ...options,
        })?.trim() ?? '';
        if (cancellationRequested()) throw Error('Development operation cancelled at its current checkpoint');
        return result;
    } catch (error) {
        // Operational output can contain passwords or SQL; keep it private.
        if (existsSync(directory)) {
            let detail = String(error.stderr ?? error.stdout ?? error.message);
            for (const secret of [redisAdmin, state?.db_password, state?.redis_password]) {
                if (secret) detail = detail.replaceAll(secret, '[REDACTED]');
            }
            const admin = platformAdmin(false);
            if (admin?.password) detail = detail.replaceAll(admin.password, '[REDACTED]');
            const file = path.join(directory, 'last-error.txt');
            writeFile(file, detail, { mode: 0o600 }).catch(() => {});
        }
        throw Error(`${program} failed during ${phase}; inspect .codeship/development/last-error.txt privately`);
    }
}

const docker = (args, input) => execute('docker', args, { input });
const inspect = name => JSON.parse(docker(['inspect', name]))[0];
const sqlLiteral = value => "'" + value.replaceAll("'", "''") + "'";

function platformAdmin(required = true) {
    const file = path.resolve(root, '../platform/.env');
    if (!existsSync(file)) {
        if (required) throw Error('Approved Platform administrator configuration is missing');
        return null;
    }
    const env = parseEnv(readFileSync(file, 'utf8'));
    if (required && (env.TENANT_ADMIN_EMAIL !== 'admin@tenant.com' || !env.TENANT_ADMIN_PASSWORD)) {
        throw Error('Expected the explicitly approved admin@tenant.com configuration');
    }
    return { email: env.TENANT_ADMIN_EMAIL, password: env.TENANT_ADMIN_PASSWORD };
}

async function save() {
    await writeFile(stateFile + '.next', JSON.stringify(state, null, 2), { mode: 0o600 });
    await rename(stateFile + '.next', stateFile);
}

async function record(status, details = {}) {
    await writeFile(path.join(directory, 'stages.jsonl'), JSON.stringify({
        at: new Date().toISOString(), command, phase, status,
        installation: state?.installation, ...details,
    }) + '\n', { flag: 'a', mode: 0o600 });
    console.log(`${phase}: ${status}`);
}

function assertState() {
    if (!state || state.owner !== owner || !/^[a-f0-9-]{36}$/.test(state.installation)) {
        throw Error('No verified owned development installation record');
    }
    if (state.database !== 'logicx_dev' || state.db_user !== 'logicx_dev' ||
        state.redis_user !== 'logicx_dev_' + state.installation.replaceAll('-', '').slice(0, 12)) {
        throw Error('Development ownership record does not match the fixed resource contract');
    }
}

function postgres(statement) {
    return docker([
        'exec', '-i', 'codebiz-infra-postgres-1', 'sh', '-c',
        'export PGPASSWORD="$(cat "$POSTGRES_PASSWORD_FILE")"; exec psql -X -v ON_ERROR_STOP=1 -At -U "$POSTGRES_USER" -d postgres',
    ], statement);
}

async function redisCredentials() {
    if (redisAdmin) return;
    const { decryptSecrets } = await import(pathToFileURL(path.join(operator, 'src/api/modules/master/application/vault.ts')));
    const database = new DatabaseSync(path.join(operator, '.codeship/data/codeship.sqlite'), { readOnly: true });
    try {
        const rows = database.prepare("SELECT public_id, username, encrypted_secrets FROM infrastructure_services WHERE kind='redis' AND environment='local-docker'").all();
        if (rows.length !== 1) throw Error('Select exactly one registered local Redis service');
        redisAdmin = decryptSecrets(rows[0].public_id, rows[0].encrypted_secrets).password;
        redisUsername = rows[0].username || 'default';
        if (!redisAdmin || /[\r\n]/.test(redisAdmin)) throw Error('Redis maintenance credential is unavailable');
    } finally {
        database.close();
    }
    const mounts = inspect('codebiz-infra-redis-1').Mounts;
    aclFile = mounts.find(m => m.Destination === '/run/secrets/users.acl')?.Source;
    if (!aclFile || !path.resolve(aclFile).startsWith(path.join(operator, '.codeship') + path.sep)) {
        throw Error('Redis ACL file is outside the registered CodeShip private directory');
    }
}

function redis(args, db = 0) {
    return docker([
        'exec', '-i', 'codebiz-infra-redis-1', 'sh', '-c',
        'IFS= read -r REDISCLI_AUTH; export REDISCLI_AUTH; user="$1"; db="$2"; shift 2; exec redis-cli --no-auth-warning --raw --user "$user" -n "$db" "$@"',
        'bash', redisUsername, String(db), ...args,
    ], redisAdmin + '\n');
}

function redisPipe(commands) {
    const encode = args => '*' + args.length + '\r\n' + args.map(value => {
        value = String(value);
        return '$' + Buffer.byteLength(value) + '\r\n' + value + '\r\n';
    }).join('');
    const result = docker(['exec', '-i', 'codebiz-infra-redis-1', 'redis-cli', '--pipe'],
        encode(['AUTH', redisUsername, redisAdmin]) + commands.map(encode).join(''));
    if (!/errors: 0/.test(result)) throw Error('Redis rejected a managed operation');
}

async function preflight() {
    if (process.env.DOCKER_HOST || (process.env.DOCKER_CONTEXT && process.env.DOCKER_CONTEXT !== 'desktop-linux')) {
        throw Error('Remote or overridden Docker endpoints are not allowed');
    }
    if (process.platform !== 'win32' || docker(['context', 'show']) !== 'desktop-linux') {
        throw Error('Only this Windows local Docker development target is authorized');
    }
    const endpoint = docker(['context', 'inspect', 'desktop-linux', '--format', '{{.Endpoints.docker.Host}}']);
    if (endpoint !== 'npipe:////./pipe/dockerDesktopLinuxEngine') {
        throw Error('Only the registered Docker Desktop Linux engine is allowed');
    }
    for (const name of ['codebiz-infra-postgres-1', 'codebiz-infra-redis-1']) {
        const facts = inspect(name);
        if (!facts.State.Running || !facts.NetworkSettings.Networks['codebiz-infra_default']) {
            throw Error(`${name} must already run on the existing infrastructure network`);
        }
    }
    await redisCredentials();
    if (redis(['PING']) !== 'PONG') throw Error('Existing Redis authentication failed');
    const plan = JSON.parse(execute('docker', ['compose', '-f', '.container/compose.dev.yml', 'config', '--format', 'json'], {
        env: {
            ...process.env,
            LOGICX_DEV_IMAGE: image,
            LOGICX_INSTALLATION: state?.installation ?? 'audit-only',
            LOGICX_DEV_CONFIG: path.join(directory, 'config.json').replaceAll('\\', '/'),
        },
    }));
    validateDevelopmentCompose(plan);
    return { postgres: postgres('SHOW server_version;'), redis: 'authenticated', redisDBs: [10, 11] };
}

function compose(args) {
    assertState();
    return execute('docker', ['compose', '-p', 'logicx-dev', '-f', '.container/compose.dev.yml', ...args], {
        env: {
            ...process.env,
            LOGICX_DEV_IMAGE: state.image,
            LOGICX_INSTALLATION: state.installation,
            LOGICX_DEV_CONFIG: path.join(directory, 'config.json').replaceAll('\\', '/'),
        },
    });
}

async function build() {
    phase = 'build';
    console.log('Building pinned development sources; no infrastructure is provisioned');
    execute('docker', ['build', '-f', '.container/Dockerfile-frappe', '-t', image, '.'], { stdio: 'inherit' });
    await record('passed', { image, versions });
}

async function prepareRedis() {
    for (const db of [10, 11]) {
        if (redis(['DBSIZE'], db) !== '0') throw Error(`Redis DB ${db} is occupied; no data will be overwritten`);
    }
    const restrictions = ['+@all', '-@admin', '+client|list', '-flushall', '-flushdb', '-swapdb', '-migrate', '-restore'];
    const rules = [
        '~logicx_dev|*', '~None|*', '~rq:*', '~frappe:*', '~bench:*', '~logicx*', '~__*',
        '~home-frappe-frappe-bench:*', '~assets_json', '&events', '&rq:*', '&logicx*',
        '&__redis__:invalidate', '&clear_persistent_cache',
    ];
    const hash = createHash('sha256').update(state.redis_password).digest('hex');
    const line = `user ${state.redis_user} on #${hash} ${rules.join(' ')} ${restrictions.join(' ')}`;
    const previous = await readFile(aclFile, 'utf8');
    if (previous.split(/\r?\n/).some(row => row.startsWith('user ' + state.redis_user + ' '))) {
        throw Error('Unexpected existing Redis account');
    }
    state.redisClaiming = true;
    await save();
    for (const db of [10, 11]) {
        if (redis(['SET', marker, state.installation, 'NX'], db) !== 'OK') throw Error('Redis reservation changed');
    }
    await writeFile(aclFile, previous.trimEnd() + '\n' + line + '\n', { mode: 0o600 });
    redisPipe([['ACL', 'SETUSER', state.redis_user, 'on', '#' + hash, 'resetkeys', 'resetchannels', ...rules, ...restrictions]]);
    checkRedisAccess();
    state.redisPrepared = true;
    await save();
}

function checkRedisAccess() {
    const required = [
        ['CLIENT', 'LIST'], ['INFO', 'server'], ['GET', 'None|app_modules'],
        ['GET', 'logicx_dev|app_hooks'], ['SUBSCRIBE', '__redis__:invalidate'],
        ['GET', 'home-frappe-frappe-bench:scheduler:heartbeat'],
        ['PUBLISH', 'clear_persistent_cache', '{}'],
    ];
    for (const args of required) {
        if (redis(['ACL', 'DRYRUN', state.redis_user, ...args]) !== 'OK') {
            throw Error('Development Redis access check failed: ' + args.slice(0, 2).join(' '));
        }
    }
    for (const denied of ['FLUSHALL', 'FLUSHDB']) {
        if (redis(['ACL', 'DRYRUN', state.redis_user, denied]) === 'OK') {
            throw Error('Development Redis account must deny ' + denied);
        }
    }
}

async function setup() {
    phase = 'preflight';
    await preflight();
    if (state && state.status !== 'cleaned') throw Error('Existing installation: use guarded clean/reinstall, not setup');
    for (const port of [4445, 4446]) {
        await new Promise((resolve, reject) => {
            const server = createServer();
            server.once('error', reject);
            server.listen(port, '127.0.0.1', () => server.close(resolve));
        });
    }
    if (docker(['ps', '-aq', '--filter', 'name=^/logicx-dev$'])) throw Error('Existing container requires ownership review');
    for (const name of volumes) {
        if (docker(['volume', 'ls', '-q', '--filter', 'name=^' + name + '$'])) throw Error('Existing development volume requires ownership review');
    }
    if (postgres("SELECT datname FROM pg_database WHERE datname='logicx_dev'; SELECT rolname FROM pg_roles WHERE rolname='logicx_dev';")) {
        throw Error('Existing PostgreSQL database/role will not be overwritten');
    }
    for (const db of [10, 11]) {
        if (redis(['DBSIZE'], db) !== '0') throw Error(`Redis DB ${db} is occupied`);
    }
    await build();
    const admin = platformAdmin();
    state = {
        owner, installation: randomUUID(), database: 'logicx_dev', db_user: 'logicx_dev',
        db_password: randomBytes(32).toString('hex'), redis_password: randomBytes(32).toString('hex'),
        redis_cache_db: 10, redis_queue_db: 11, image, versions, status: 'preparing',
    };
    state.redis_user = 'logicx_dev_' + state.installation.replaceAll('-', '').slice(0, 12);
    await save();
    await writeFile(path.join(directory, 'config.json'), JSON.stringify({
        ...state, site: 'logicx.localhost', admin_email: admin.email, admin_password: admin.password,
    }), { mode: 0o600 });
    phase = 'postgres-provision';
    const tag = sqlLiteral('logicx-dev:' + state.installation);
    postgres(`BEGIN; CREATE ROLE logicx_dev LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ${sqlLiteral(state.db_password)}; COMMENT ON ROLE logicx_dev IS ${tag}; COMMIT;`);
    state.databaseCreating = true;
    await save();
    postgres(`CREATE DATABASE logicx_dev OWNER logicx_dev; COMMENT ON DATABASE logicx_dev IS ${tag};`);
    await record('passed', { database: 'logicx_dev', role: 'logicx_dev', privileges: 'database owner only' });
    phase = 'redis-reservation';
    await prepareRedis();
    await record('passed', { databases: [10, 11], user: state.redis_user });
    phase = 'site-install';
    console.log('Preparing the Bench volume and installing the site; this can take several minutes');
    compose(['run', '--rm', '--no-deps', 'frappe', 'init']);
    await record('passed');
    phase = 'start';
    compose(['up', '-d', '--no-build']);
    state.status = 'running';
    await save();
    await verify();
}

async function verify() {
    assertState();
    phase = 'verify';
    const facts = inspect('logicx-dev');
    if (facts.Config.Labels['io.logicx.installation'] !== state.installation || !facts.State.Running) {
        throw Error('Development container ownership/readiness mismatch');
    }
    for (let attempt = 0; attempt < 45; attempt++) {
        try {
            const response = await fetch('http://127.0.0.1:4445/api/method/ping', { signal: AbortSignal.timeout(2000) });
            if (response.ok) break;
        } catch {}
        if (attempt === 44) throw Error('Development web server did not become ready');
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    const result = JSON.parse(compose(['exec', '-T', 'frappe', '/bin/bash', '/opt/logicx/dev-entrypoint.sh', 'verify']));
    const admin = platformAdmin();
    const origin = 'http://127.0.0.1:4445';
    const login = await fetch(origin + '/api/method/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usr: admin.email, pwd: admin.password }),
        signal: AbortSignal.timeout(10000),
    });
    if (!login.ok) throw Error('Configured email login failed');
    const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const page = await fetch(origin + '/logicx-app', {
        headers: { Cookie: cookie }, signal: AbortSignal.timeout(10000),
    });
    const html = await page.text();
    if (!page.ok || !html.includes('/assets/logicx_app/frontend/assets/')) {
        throw Error('Authenticated LogicX page did not load');
    }
    const assetPath = html.match(/(?:src|href)=["'](\/assets\/logicx_app\/frontend\/assets\/[^"']+\.js)["']/)?.[1];
    if (!assetPath) throw Error('LogicX JavaScript asset reference is missing');
    const asset = await fetch(origin + assetPath, { signal: AbortSignal.timeout(10000) });
    if (!asset.ok || !/javascript/.test(asset.headers.get('content-type') ?? '')) {
        throw Error('Built LogicX JavaScript asset did not load');
    }
    const realtime = await fetch('http://127.0.0.1:4446/socket.io/?EIO=4&transport=polling', {
        signal: AbortSignal.timeout(10000),
    });
    if (!realtime.ok || !(await realtime.text()).startsWith('0{')) {
        throw Error('Development realtime endpoint did not become ready');
    }
    const product = await fetch(origin + '/api/resource/LogicX%20Product?limit_page_length=1', {
        headers: { Cookie: cookie }, signal: AbortSignal.timeout(10000),
    });
    if (!product.ok) throw Error('Authenticated product API readiness failed');
    result.emailLogin = true;
    result.logicxPage = true;
    result.javascriptAsset = true;
    result.realtime = true;
    result.productApi = true;
    await record('passed', result);
    console.log(JSON.stringify(result, null, 2));
}

async function clean() {
    assertState();
    phase = 'clean';
    await preflight();
    const tag = 'logicx-dev:' + state.installation;
    const roleTag = postgres("SELECT COALESCE(shobj_description(oid,'pg_authid'),'') FROM pg_roles WHERE rolname='logicx_dev';");
    const database = postgres("SELECT COALESCE(shobj_description(d.oid,'pg_database'),'') || '|' || r.rolname FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE d.datname='logicx_dev';");
    if (roleTag && roleTag !== tag) throw Error('PostgreSQL role belongs to another owner');
    if (database && database !== tag + '|logicx_dev' && !(state.databaseCreating && database === '|logicx_dev' && roleTag === tag)) {
        throw Error('PostgreSQL database ownership changed; cleanup refused');
    }
    const primary = docker(['ps', '-aq', '--filter', 'name=^/logicx-dev$']);
    const containers = docker(['ps', '-aq', '--filter', 'label=com.docker.compose.project=logicx-dev'])
        .split('\n').filter(Boolean);
    if (primary && !containers.includes(primary)) throw Error('The named container belongs to another project');
    for (const container of containers) {
        const labels = inspect(container).Config.Labels;
        if (labels['io.logicx.installation'] !== state.installation || labels['io.codebiz.owner'] !== owner) {
            throw Error('A project container is not owned by this installation');
        }
    }
    for (const name of volumes) {
        if (docker(['volume', 'ls', '-q', '--filter', 'name=^' + name + '$'])) {
            const labels = JSON.parse(docker(['volume', 'inspect', name]))[0].Labels;
            if (labels?.['io.logicx.installation'] !== state.installation) throw Error('Volume ownership changed');
        }
    }
    if (state.redisClaiming) {
        for (const db of [10, 11]) {
            const held = redis(['GET', marker], db);
            if (held && held !== state.installation) throw Error('Redis reservation belongs to another installation');
            if (!held && redis(['DBSIZE'], db) !== '0') throw Error('Redis ownership marker is missing');
        }
    }
    for (const container of containers) {
        docker(['stop', '--timeout', '20', container]);
        docker(['rm', container]);
    }
    for (const name of volumes) {
        if (docker(['volume', 'ls', '-q', '--filter', 'name=^' + name + '$'])) docker(['volume', 'rm', name]);
    }
    if (database) postgres('DROP DATABASE logicx_dev WITH (FORCE);');
    if (roleTag) postgres('DROP ROLE logicx_dev;');
    if (state.redisClaiming) {
        for (const db of [10, 11]) {
            if (redis(['GET', marker], db) !== state.installation) continue;
            let cursor = '0';
            do {
                const page = redis(['SCAN', cursor, 'COUNT', '250'], db).split('\n');
                cursor = page.shift();
                const keys = page.filter(key => key && key !== marker);
                if (keys.length) redis(['UNLINK', ...keys], db);
            } while (cursor !== '0');
            redis(['UNLINK', marker], db);
        }
        redisPipe([['ACL', 'DELUSER', state.redis_user]]);
        const current = await readFile(aclFile, 'utf8');
        await writeFile(aclFile, current.split(/\r?\n/).filter(line => !line.startsWith('user ' + state.redis_user + ' ')).join('\n'), { mode: 0o600 });
    }
    state.status = 'cleaned';
    await save();
    if (existsSync(path.join(directory, 'config.json'))) await unlink(path.join(directory, 'config.json'));
    await record('passed', { scope: 'recorded LogicX development resources only; infrastructure retained' });
}

await mkdir(directory, { recursive: true, mode: 0o700 });
if (process.platform === 'win32') {
    const account = execute('whoami', []);
    execute('icacls', [directory, '/inheritance:r', '/grant:r', account + ':(OI)(CI)F']);
}

const lockFile = path.join(operator, '.codeship/devkits/operation.lock');
if (command === 'recover-build') {
    // Docker's buildx plugin can outlive a forcibly stopped Docker CLI on Windows.
    // Only terminate an orphan whose complete arguments identify our pinned image.
    const expected = `buildx build -f .container/Dockerfile-frappe -t ${image} .`;
    const script = `
        $expected = '${expected}'
        $orphans = @(Get-CimInstance Win32_Process -Filter "Name='docker-buildx.exe'" |
            Where-Object { $_.CommandLine.EndsWith($expected) -and
                !(Get-CimInstance Win32_Process -Filter "ProcessId=$($_.ParentProcessId)") })
        if ($orphans.Count -gt 1) { throw 'Multiple orphan builds; no process was stopped' }
        foreach ($orphan in $orphans) { Stop-Process -Id $orphan.ProcessId -Force }
        "Recovered $($orphans.Count) orphaned LogicX build client(s)"
    `;
    console.log(execute('powershell.exe', ['-NoProfile', '-Command', script]));
    process.exit(0);
}
if (command === 'cancel-build') {
    if (!existsSync(lockFile)) {
        console.log('No build is active');
        process.exit(0);
    }
    const operation = JSON.parse(await readFile(lockFile, 'utf8'));
    if (operation.owner !== owner || !/^development:(build|setup|reinstall)$/.test(operation.operation) ||
        !Number.isSafeInteger(operation.pid)) {
        throw Error('The active operation is not this development installer; left intact');
    }
    const script = `
        $installerId = ${operation.pid}
        $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$installerId"
        if (!$parent -or $parent.CommandLine -notmatch 'dev[.]mjs.+(build|setup|reinstall)') {
            throw 'Installer process identity differs; left intact'
        }
        $builds = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$installerId" |
            Where-Object { $_.Name -eq 'docker.exe' -and $_.CommandLine -match 'build.+Dockerfile-frappe' })
        if ($builds.Count -ne 1) { throw 'No unique owned build client; no process was stopped' }
        $plugins = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($builds[0].ProcessId)" |
            Where-Object { $_.Name -eq 'docker-buildx.exe' -and $_.CommandLine -match 'build.+Dockerfile-frappe' })
        foreach ($plugin in $plugins) { Stop-Process -Id $plugin.ProcessId -Force }
        if (Get-Process -Id $builds[0].ProcessId -ErrorAction SilentlyContinue) {
            Stop-Process -Id $builds[0].ProcessId -Force
        }
        'Owned build client stopped; installer will record failure and release its own lock'
    `;
    await writeFile(cancelFile, operation.id, { mode: 0o600 });
    console.log(execute('powershell.exe', ['-NoProfile', '-Command', script]));
    process.exit(0);
}
const lock = ['audit', 'diagnose'].includes(command) ? null : await open(lockFile, 'wx', 0o600);
const token = JSON.stringify({ owner, operation: 'development:' + command, pid: process.pid, id: randomUUID() });
if (lock) await lock.writeFile(token);
if (lock) activeOperation = JSON.parse(token).id;

try {
    if (command === 'audit') {
        const result = await preflight();
        console.log(JSON.stringify({ ...result, versions, state: state?.status ?? 'not installed', redisKeyCounts: [10, 11].map(db => ({ db, keys: Number(redis(['DBSIZE'], db)) })) }, null, 2));
    } else if (command === 'diagnose') {
        await preflight();
        assertState();
        checkRedisAccess();
        const entries = JSON.parse(redis(['--json', 'ACL', 'LOG', '128']));
        const denied = entries.map(entry => Array.isArray(entry)
            ? Object.fromEntries(Array.from({ length: entry.length / 2 }, (_, index) => entry.slice(index * 2, index * 2 + 2)))
            : entry).filter(entry => entry.username === state.redis_user)
            .map(({ reason, object, context }) => ({ reason, object, context }));
        const postgresActivity = postgres("SELECT state || ':' || COALESCE(wait_event_type,'active') || ':' || COALESCE(wait_event,'') FROM pg_stat_activity WHERE datname='logicx_dev';");
        console.log(JSON.stringify({
            redisAccessChecks: true, redisDenied: denied,
            postgresActivity: postgresActivity ? postgresActivity.split('\n') : [],
        }, null, 2));
    } else if (command === 'build') {
        await preflight();
        await build();
    } else if (command === 'setup') {
        await setup();
    } else if (command === 'clean' || command === 'reinstall') {
        if (state && state.status !== 'cleaned') await clean();
        else console.log('No recorded development resources to clean; shared infrastructure retained');
        if (command === 'reinstall') await setup();
    } else {
        await preflight();
        assertState();
        if (command === 'verify') await verify();
        if (command === 'start') {
            compose(['up', '-d', '--no-build']);
            state.status = 'running';
            await save();
            await verify();
        }
        if (command === 'stop') {
            compose(['stop']);
            state.status = 'stopped';
            await save();
            await record('passed');
        }
        if (command === 'assets') {
            compose(['exec', '-T', 'frappe', '/bin/bash', '/opt/logicx/dev-entrypoint.sh', 'assets']);
            await record('passed');
        }
        if (['migrate-general-master', 'verify-general-master', 'migrate-line-master', 'verify-line-master'].includes(command)) {
            const facts = inspect('logicx-dev');
            if (!facts.State.Running || facts.Config.Labels['io.logicx.installation'] !== state.installation) {
                throw Error('The owned development container must be running');
            }
            const script = command.replaceAll('-', '_') + '.py';
            console.log(compose(['exec', '-T', '-u', 'frappe', 'frappe',
                '/home/frappe/frappe-bench/env/bin/python', '/workspace/logicx-app/.container/' + script]));
            await record('passed');
        }
    }
} catch (error) {
    if (state && state.status !== 'cleaned') {
        state.lastFailure = phase;
        await save();
    }
    await record('failed', { message: error.message });
    console.error(error.message);
    process.exitCode = 1;
} finally {
    if (lock) {
        await lock.close();
        if (await readFile(lockFile, 'utf8') === token) await unlink(lockFile);
        if (cancellationRequested()) await unlink(cancelFile);
    }
}
