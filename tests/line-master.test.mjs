import assert from 'node:assert/strict';
import test from 'node:test';
import { lineMasterApi } from '../frontend/src/api.js';

globalThis.window = { csrf_token: 'test-csrf' };

test('Line Master saves only business fields and excludes generated serial and owner', async () => {
    const originalFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (url, options) => {
        requests.push({ url, ...options });
        return Response.json({ data: { name: 'record-id' } });
    };
    try {
        const values = { factory: ' Factory ', floor: ' 1 ', area: ' Sewing ', line_no: ' 01 ', name: 'forged', owner: 'Guest' };
        await lineMasterApi.save(null, values);
        await lineMasterApi.save('record/id', values);
        assert.equal(requests[0].method, 'POST');
        assert.deepEqual(JSON.parse(requests[0].body), { factory: 'Factory', floor: '1', area: 'Sewing', line_no: '01' });
        assert.equal(requests[1].url, '/api/resource/Line%20Master/record%2Fid');
        assert.equal(requests[1].method, 'PUT');
        assert.equal(JSON.parse(requests[1].body).name, undefined);
    } finally { globalThis.fetch = originalFetch; }
});
