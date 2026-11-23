import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDevelopmentCompose } from '../.container/dev-policy.mjs';

function plan() {
    return {
        name: 'logicx-dev',
        services: {
            frappe: {
                container_name: 'logicx-dev',
                ports: [4445, 4446].map(port => ({ host_ip: '127.0.0.1', published: String(port), target: port })),
                volumes: [{ source: 'logicx_dev_bench' }],
            },
        },
        networks: { infrastructure: { external: true, name: 'codebiz-infra_default' } },
    };
}

test('additional database or Redis servers cannot enter the plan', () => {
    for (const name of ['postgres', 'redis', 'mariadb']) {
        const value = plan();
        value.services[name] = {};
        assert.throws(() => validateDevelopmentCompose(value));
    }
    validateDevelopmentCompose(plan());
});

test('public ports, replacement networks and operator mounts are rejected', () => {
    const value = plan();
    value.services.frappe.ports[0].host_ip = '0.0.0.0';
    assert.throws(() => validateDevelopmentCompose(value));
    const network = plan();
    network.networks.infrastructure.external = false;
    assert.throws(() => validateDevelopmentCompose(network));
    const mount = plan();
    mount.services.frappe.volumes.push({ source: '/var/run/docker.sock' });
    assert.throws(() => validateDevelopmentCompose(mount));
});
