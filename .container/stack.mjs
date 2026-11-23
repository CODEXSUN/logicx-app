import {contract} from './release.mjs';

/** Public topology; the host adapter supplies only checked images/private paths. */
export function stack(image,privateDir,{project='logicx-app',infra='codebiz-infra_default',port=14445}={}) {
 if(!/^sha256:[a-f0-9]{64}$/.test(image)&&!/@sha256:[a-f0-9]{64}$/.test(image))throw Error('Immutable image required');
 const label={'io.codebiz.owner':'apps/logicx-app','io.codebiz.target':'ubuntu-lan'};
 const common={image,restart:'unless-stopped',labels:label,volumes:['sites:/home/frappe/frappe-bench/sites','logs:/home/frappe/frappe-bench/logs'],networks:['internal','infra'],environment:{LOGICX_MANAGED_RELEASE:'1'},security_opt:['no-new-privileges:true'],depends_on:{'redis-cache':{condition:'service_healthy'},'redis-queue':{condition:'service_healthy'}}};
 const redis=(queue)=>({image:contract.redisImage,restart:'unless-stopped',labels:label,command:['redis-server','/usr/local/etc/redis/redis.conf'],volumes:[`${privateDir}/redis-${queue?'queue':'cache'}.conf:/usr/local/etc/redis/redis.conf:ro`,...(queue?['queue:/data']:[])],networks:['internal'],healthcheck:{test:['CMD-SHELL','REDISCLI_AUTH=$$(sed -n "s/^requirepass //p" /usr/local/etc/redis/redis.conf) redis-cli --no-auth-warning ping | grep -qx PONG'],interval:'5s',timeout:'3s',retries:20}});
 const services={
  'redis-cache':redis(false),'redis-queue':redis(true),
  init:{...common,restart:'no',profiles:['install'],command:['/home/frappe/frappe-bench/env/bin/python','/opt/logicx/release_init.py'],volumes:[...common.volumes,`${privateDir}/logicx-install.json:/run/secrets/logicx-install.json:ro`]},
  backend:{...common,healthcheck:{test:['CMD','/home/frappe/frappe-bench/env/bin/python','-c',"import urllib.request; r=urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8000/api/method/ping',headers={'Host':'logicx.localhost'})); assert r.status==200"],interval:'15s',timeout:'5s',retries:12,start_period:'30s'}},
  websocket:{...common,command:['node','/home/frappe/frappe-bench/apps/frappe/socketio.js']},
  'queue-short':{...common,command:['bench','worker','--queue','short,default']},
  'queue-long':{...common,command:['bench','worker','--queue','long']},
  scheduler:{...common,command:['bench','schedule']},
  frontend:{...common,command:['nginx-entrypoint.sh'],environment:{BACKEND:'backend:8000',SOCKETIO:'websocket:9000',NGINX_LISTEN_PORT:'4445',FRAPPE_SITE_NAME_HEADER:'logicx.localhost',CLIENT_MAX_BODY_SIZE:'25m',PROXY_READ_TIMEOUT:'120'},networks:['internal'],ports:[`127.0.0.1:${port}:4445`],depends_on:{...common.depends_on,backend:{condition:'service_healthy'},websocket:{condition:'service_started'}},healthcheck:{test:['CMD','/home/frappe/frappe-bench/env/bin/python','-c',"import urllib.request; assert urllib.request.urlopen('http://127.0.0.1:4445/api/method/ping').status==200"],interval:'15s',timeout:'5s',retries:12,start_period:'30s'}},
 };
 return {name:project,services,networks:{internal:{name:project+'_internal'},infra:{external:true,name:infra}},volumes:{sites:{name:project+'_sites'},logs:{name:project+'_logs'},queue:{name:project+'_queue'}}};
}
