/** Guard the app-specific Compose plan before any infrastructure mutation. */
export function validateDevelopmentCompose(plan) {
    if (plan.name !== 'logicx-dev' || Object.keys(plan.services).join() !== 'frappe') {
        throw Error('The development plan must contain only the Frappe application service');
    }
    const service = plan.services.frappe;
    if (service.container_name !== 'logicx-dev' || service.privileged || service.network_mode || service.pid === 'host') {
        throw Error('Unexpected development container isolation settings');
    }
    const network = plan.networks.infrastructure;
    if (!network?.external || network.name !== 'codebiz-infra_default') {
        throw Error('Reuse the existing external infrastructure network');
    }
    const ports = service.ports.map(port => `${port.host_ip}:${port.published}:${port.target}`).sort();
    if (ports.join() !== ['127.0.0.1:4445:4445', '127.0.0.1:4446:4446'].join()) {
        throw Error('Development ports must use the two reserved loopback bindings');
    }
    for (const mount of service.volumes) {
        if (/docker[.]sock|[\\/]\.ssh(?:[\\/]|$)/i.test(mount.source ?? '')) {
            throw Error('Operator credentials and Docker control must not enter the application');
        }
    }
}
