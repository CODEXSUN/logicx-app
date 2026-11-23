import assert from 'node:assert/strict';
import test from 'node:test';
import { generalMasterApi } from '../frontend/src/api.js';

globalThis.window = { csrf_token: 'test-csrf' };

test('form saves only business fields with an explicit boolean Active value', async () => {
    const originalFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (url, options) => {
        requests.push({ url, ...options });
        return Response.json({ data: { name: 'record-id' } });
    };
    try {
        const values = { type: ' Process ', master_name: ' Cutting ', description: ' Desc ', active: 'Active', tag: ' Sewing ', owner: 'Guest' };
        await generalMasterApi.save(null, values);
        await generalMasterApi.save('record/id', { ...values, active: 'Inactive' });
        assert.equal(requests[0].method, 'POST');
        assert.equal(requests[0].headers['X-Frappe-CSRF-Token'], 'test-csrf');
        assert.deepEqual(JSON.parse(requests[0].body), {
            type: 'Process', master_name: 'Cutting', description: 'Desc', active: 1, tag: 'Sewing',
        });
        assert.equal(requests[1].url, '/api/resource/General%20Master/record%2Fid');
        assert.equal(requests[1].method, 'PUT');
        assert.equal(JSON.parse(requests[1].body).active, 0);
    } finally { globalThis.fetch = originalFetch; }
});

test('the complete list follows Frappe pagination beyond the first batch', async () => {
    const originalFetch = globalThis.fetch;
    const offsets = [];
    globalThis.fetch = async url => {
        const offset = Number(new URL(url, 'http://localhost').searchParams.get('limit_start'));
        offsets.push(offset);
        return Response.json({ data: Array.from({ length: offset === 0 ? 500 : 1 }, (_, index) => ({ name: String(offset + index) })) });
    };
    try {
        const result = await generalMasterApi.list();
        assert.equal(result.length, 501);
        assert.equal(result[500].name, '500');
        assert.deepEqual(offsets, [0, 500]);
    } finally { globalThis.fetch = originalFetch; }
});

test('master head options use distinct Values under Type only', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => Response.json({ data: [
        { type: 'Type', master_name: 'Line Name', active: 1 },
        { type: 'Type', master_name: 'Obsolete category', active: 0 },
        { type: 'Singer', master_name: 'juki', active: 1 },
        { type: ' type ', master_name: 'Line Name', active: 1 },
    ] });
    try {
        assert.deepEqual(await generalMasterApi.heads(), ['Line Name', 'Obsolete category']);
    } finally { globalThis.fetch = originalFetch; }
});
