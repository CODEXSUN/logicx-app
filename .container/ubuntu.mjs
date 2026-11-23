import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,open,unlink,stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {hostname} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:net';
import {contract} from './release.mjs';
import {stack} from './stack.mjs';

const [mode,flag,setFile]=process.argv.slice(2);
if(!['setup','verify'].includes(mode)||flag!=='--release-set'||!setFile||process.argv.length!==5)throw Error('Use setup|verify --release-set <approved-set.json>');
const root='/srv/codebiz',target=JSON.parse(await readFile(root+'/target.json'));
if(process.platform!=='linux'||hostname()!=='cxserver'||target.id!=='ubuntu-lan'||target.host!=='192.168.1.34'||target.binding!=='127.0.0.1'||target.publicExposure!==false||target.lock!==root+'/state/devkits/operation.lock')throw Error('Ubuntu target identity mismatch');
const operator=target.operator;
const shared=async file=>import(pathToFileURL(path.join(operator,file)));
const {validateManifest}=await shared('.container/release-policy.mjs');
const {resolveReleaseImage}=await shared('.container/release-image.mjs');
const {openDatabase}=await shared('src/api/database.ts');
const {applicationRepository}=await shared('src/api/modules/master/application/repository.ts');
const set=JSON.parse(await readFile(setFile)),candidate=set.services?.['logicx-app'];
if(set.schema!==1||set.source!=='github'||Object.keys(set.services??{}).join()!=='logicx-app')throw Error('One approved LogicX release required');
const manifest=validateManifest(candidate,{owner:contract.owner,repository:contract.repository,tag:'v-0.1.6',commit:candidate.commit});
if(manifest.frappeImage!==contract.frappeImage||manifest.redisImage!==contract.redisImage||manifest.version!=='0.1.6'||JSON.stringify(manifest.target)!==JSON.stringify(contract.target))throw Error('Unexpected approved Bench release');
const sourceRoot=path.resolve(import.meta.dirname,'..');
if(execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).trim()!==manifest.commit||execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:sourceRoot,encoding:'utf8'}).trim())throw Error('Use the clean, exact tagged LogicX operator source');
const dir=root+'/state/logicx-app',privateDir=root+'/private/logicx-app';
const lockToken=JSON.stringify({pid:process.pid,operation:'logicx-app:'+mode,token:randomUUID(),target:target.id});
const lock=await open(target.lock,'wx',0o600);await lock.writeFile(lockToken);
const {db}=openDatabase();
let phase='preflight';
const docker=(args,input)=>{
 try{return execFileSync('docker',args,{input,encoding:'utf8',maxBuffer:32*1024*1024,timeout:1200000,stdio:['pipe','pipe','pipe']}).trim();}
 catch{throw Error('Docker operation failed during '+phase+'; retained data and private stage state require review');}
};
const compose=args=>docker(['compose','--project-name','logicx-app','--file',dir+'/compose.json',...args]);
const stage=async(status,details={})=>{await mkdir(dir,{recursive:true,mode:0o700});await writeFile(dir+'/stages.jsonl',JSON.stringify({at:new Date().toISOString(),phase,status,...details})+'\n',{flag:'a',mode:0o600});console.log(phase+' '+status);};
// Use narrow inspect fields; never serialize container environments or credentials.
function baseline(){const ids=docker(['ps','-q']);if(!ids)return [];return ids.split('\n').map(id=>JSON.parse(docker(['inspect',id,'--format','{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Image}},"mounts":{{json .Mounts}}}']))).filter(x=>!x.name.startsWith('/logicx-app-')).sort((a,b)=>a.name.localeCompare(b.name));}
async function verify(){
 const inspect=JSON.parse(docker(['inspect',...compose(['ps','-q']).split('\n')]));
 if(inspect.length!==8||inspect.some(c=>!c.State.Running||c.RestartCount!==0||c.Config.Labels['io.codebiz.owner']!==contract.owner))throw Error('LogicX service readiness incomplete');
 const redisId=docker(['image','inspect',contract.redisImage,'--format','{{.Id}}']);
 for(const c of inspect){
  if(c.Name.includes('redis-')){if(c.State.Health?.Status!=='healthy'||c.Image!==redisId)throw Error('Redis image/health check failed');}else if(c.Image!==manifest.imageId)throw Error('Running image identity differs');
  const bindings=Object.entries(c.HostConfig.PortBindings??{}).flatMap(([port,values])=>values.map(v=>({port,...v})));
  if(c.Name.includes('-frontend-')){if(bindings.length!==1||bindings[0].port!=='4445/tcp'||bindings[0].HostIp!=='127.0.0.1'||bindings[0].HostPort!=='14445')throw Error('Frontend private binding mismatch');}
  else if(bindings.length)throw Error('Unexpected additional published port');
  if(c.Mounts.some(m=>m.Destination.includes('docker.sock')||m.Destination.includes('.ssh')||m.Destination.includes('logicx-install.json')))throw Error('Forbidden runtime credential/control mount');
 }
 const response=await fetch('http://127.0.0.1:14445/api/method/ping',{signal:AbortSignal.timeout(10000)});if(!response.ok||(await response.json()).message!=='pong')throw Error('Frappe HTTP readiness failed');
 const runtime=JSON.parse(compose(['exec','-T','backend','env/bin/python','/opt/logicx/verify_runtime.py']));
 const apps=runtime.apps;
 if(!['frappe','erpnext','logicx_app'].every(x=>apps.includes(x)))throw Error('Installed apps incomplete');
 return {...runtime,services:inspect.map(c=>({name:c.Name,image:c.Image,running:c.State.Running,health:c.State.Health?.Status})),port:14445};
}
try{
 if(mode==='verify'){phase='verify';const result=await verify();await stage('passed',result);console.log(JSON.stringify(result));}
 else{
  if(existsSync(dir+'/installation.json')||docker(['ps','-aq','--filter','label=com.docker.compose.project=logicx-app']))throw Error('Existing LogicX state; installation must be reviewed rather than recreated');
  for(const name of ['logicx-app_sites','logicx-app_logs','logicx-app_queue']){if(docker(['volume','ls','-q','--filter','name=^'+name+'$']))throw Error('Existing LogicX volume requires review');}
  if(docker(['inspect','codebiz-infra-mariadb-1','--format','{{.State.Health.Status}}'])!=='healthy')throw Error('Shared MariaDB is not healthy');
  await new Promise((resolve,reject)=>{const server=createServer();server.once('error',reject);server.listen(14445,'127.0.0.1',()=>server.close(resolve));});
  const before=baseline();
  await mkdir(privateDir,{recursive:true,mode:0o700});
  const imported=privateDir+'/approved-admin.json';
  if((await stat(imported)).mode&0o077)throw Error('Approved credential file must be private');
  const admin=JSON.parse(await readFile(imported));if(admin.email!=='admin@tenant.com'||typeof admin.password!=='string'||admin.password.length<8)throw Error('Approved Platform administrator credential missing');
  phase='release-image';await stage('started');
  const image=await resolveReleaseImage(manifest,args=>docker(args),root+'/releases/cache');
  const labels=JSON.parse(docker(['image','inspect',image,'--format','{{json .Config.Labels}}']));
  if(labels['org.opencontainers.image.version']!==manifest.version||labels['org.opencontainers.image.revision']!==manifest.commit)throw Error('Release image label mismatch');
  await stage('passed');
  const values={site:'logicx.localhost',database:'logicx_app',db_user:'logicx_app',db_password:randomBytes(32).toString('hex'),redis_password:randomBytes(32).toString('hex'),admin_email:admin.email,admin_password:admin.password};
  const rows=await db.selectFrom('applications').selectAll().where('owner','=',contract.owner).execute();if(rows.length)throw Error('Existing registry credentials require review');
  const row=await applicationRepository(db).save({name:'LogicX',owner:contract.owner,version:manifest.version,environment:'vps',project:'logicx-app',host:'192.168.1.34',port:14445,username:admin.email,notes:'Ubuntu LAN fresh Frappe/ERPNext; private SSH access; app-owned Bench adapter',secrets:{password:admin.password,adminPassword:admin.password},environmentChanges:{TENANT_ADMIN_USERNAME:admin.email,TENANT_ADMIN_EMAIL:admin.email,LOGICX_SITE_NAME:values.site,LOGICX_DB_NAME:values.database,LOGICX_DB_USER:values.db_user,LOGICX_DB_PASSWORD:values.db_password,LOGICX_REDIS_PASSWORD:values.redis_password}});
  await writeFile(dir+'/installation.json',JSON.stringify({phase:'registered',publicId:row.public_id,manifest,createdAt:new Date().toISOString()},null,2),{mode:0o600,flag:'wx'});
  await unlink(imported);
  await writeFile(privateDir+'/logicx-install.json',JSON.stringify(values),{mode:0o400,flag:'wx'});
  for(const kind of ['cache','queue'])await writeFile(privateDir+'/redis-'+kind+'.conf',`bind 0.0.0.0\nprotected-mode yes\nrequirepass ${values.redis_password}\n${kind==='queue'?'appendonly yes\nappendfsync everysec':'save ""'}\n`,{mode:0o444,flag:'wx'});
  await writeFile(dir+'/compose.json',JSON.stringify(stack(image,privateDir),null,2),{mode:0o600,flag:'wx'});
  compose(['config','--quiet']);
  phase='database';await stage('started');
  const sql=statement=>docker(['exec','-i','codebiz-infra-mariadb-1','sh','-c','export MYSQL_PWD="$(cat "$MARIADB_ROOT_PASSWORD_FILE")"; exec mariadb --protocol=TCP -h127.0.0.1 -P3307 -uroot --batch --skip-column-names'],statement);
  const engine=sql('SELECT VERSION();');if(!/^11[.]8[.]/.test(engine))throw Error('Shared MariaDB version differs from the reviewed 11.8 compatibility contract');
  const existing=sql("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='logicx_app'; SELECT User FROM mysql.user WHERE User='logicx_app';");if(existing)throw Error('Existing LogicX database/user requires manual review');
  sql(`CREATE DATABASE logicx_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER 'logicx_app'@'%' IDENTIFIED BY '${values.db_password}'; GRANT ALL PRIVILEGES ON logicx_app.* TO 'logicx_app'@'%';`);
  await stage('passed',{database:'logicx_app',scope:'logicx_app.*; no global privileges or grant option',backup:'skipped: verified empty first installation; no existing app data'});
  phase='site-install';await stage('started');
  compose(['up','-d','--wait','redis-cache','redis-queue']);
  const output=compose(['run','--rm','--no-deps','init']);
  await writeFile(dir+'/install.log',output.replaceAll(values.admin_password,'[REDACTED]').replaceAll(values.db_password,'[REDACTED]').replaceAll(values.redis_password,'[REDACTED]'),{mode:0o600});
  await unlink(privateDir+'/logicx-install.json');
  await stage('passed');
  phase='runtime';await stage('started');compose(['up','-d','--wait','--wait-timeout','240']);await stage('passed');
  phase='verify';const result=await verify();
  if(JSON.stringify(before)!==JSON.stringify(baseline()))throw Error('Sibling containers changed; review concurrent operations');
  await stage('passed',result);
  await writeFile(dir+'/state.json',JSON.stringify({verifiedAt:new Date().toISOString(),manifest,...result},null,2),{mode:0o600});
  console.log('LogicX release verified on Ubuntu private port 14445');
 }
}catch(error){await stage('failed',{message:String(error.message)});throw error;}
finally{await db.destroy();await lock.close();if(await readFile(target.lock,'utf8')===lockToken)await unlink(target.lock);}
