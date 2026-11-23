import test from 'node:test';
import assert from 'node:assert/strict';
import {stack} from '../.container/stack.mjs';
test('only the private LogicX front door is published; installation secrets are one-shot',()=>{
 const compose=stack('sha256:'+'a'.repeat(64),'/private');
 assert.deepEqual(Object.values(compose.services).flatMap(s=>s.ports??[]),['127.0.0.1:14445:4445']);
 for(const [name,s]of Object.entries(compose.services)){
  assert.equal(s.network_mode,undefined);
  if(name!=='init')assert(!JSON.stringify(s).includes('logicx-install.json'));
  assert(!JSON.stringify(s).includes('docker.sock'));
 }
 assert(!compose.services['redis-cache'].networks.includes('infra'));
 assert(!compose.services['redis-queue'].networks.includes('infra'));
 assert(!compose.services.frontend.networks.includes('infra'));
});
