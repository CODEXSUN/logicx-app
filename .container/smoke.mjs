// Disposable integration fixture. Never connects to registered application data.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {stack} from './stack.mjs';
const image=process.argv[2];if(!/^sha256:[a-f0-9]{64}$/.test(image??''))throw Error('Select the built candidate image ID');
const project='logicx-smoke-'+randomBytes(5).toString('hex'),directory=path.resolve('.codeship',project),infra=project+'_infra';
mkdirSync(directory,{recursive:true,mode:0o700});
const values={site:'logicx.localhost',database:'logicx_app',db_user:'logicx_app',db_password:'disposable-app-only',admin_email:'admin@tenant.com',admin_password:'disposable-admin-only',redis_password:'disposable-redis-only'};
writeFileSync(directory+'/logicx-install.json',JSON.stringify(values),{mode:0o444});
for(const kind of ['cache','queue'])writeFileSync(directory+'/redis-'+kind+'.conf','bind 0.0.0.0\nprotected-mode yes\nrequirepass disposable-redis-only\n',{mode:0o444});
const fixture=stack(image,directory.replaceAll('\\','/'),{project,infra});
delete fixture.services.frontend.ports;
fixture.services.mariadb={image:'mariadb:11.8.9@sha256:d36f18d65a0459510b8b0f643b226a6d299e3206486e2b64ff20754a6d291707',environment:{MARIADB_ROOT_PASSWORD:'disposable-root-only'},command:['--port=3307','--innodb-flush-log-at-trx-commit=2','--sync-binlog=0'],tmpfs:['/var/lib/mysql:rw,size=2147483648'],networks:['infra'],healthcheck:{test:['CMD','healthcheck.sh','--connect','--innodb_initialized'],interval:'5s',timeout:'5s',retries:30}};
for(const service of Object.values(fixture.services))service.labels={...service.labels,'io.codebiz.target':'disposable-test'};
writeFileSync(directory+'/compose.json',JSON.stringify(fixture,null,2));
const docker=(args,input)=>execFileSync('docker',args,{encoding:'utf8',input,timeout:1200000,maxBuffer:32*1024*1024,stdio:['pipe','pipe','pipe']}).trim();
const compose=args=>docker(['compose','-p',project,'-f',directory+'/compose.json',...args]);
let passed=false;
try{
 docker(['network','create',infra]);
 console.log('Starting disposable MariaDB and isolated Redis');
 compose(['up','-d','--wait','mariadb','redis-cache','redis-queue']);
 docker(['compose','-p',project,'-f',directory+'/compose.json','exec','-T','mariadb','sh','-c','MYSQL_PWD=disposable-root-only mariadb -uroot -h127.0.0.1 -P3307'],"CREATE DATABASE logicx_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER 'logicx_app'@'%' IDENTIFIED BY 'disposable-app-only'; GRANT ALL PRIVILEGES ON logicx_app.* TO 'logicx_app'@'%';");
 console.log('Installing Frappe, ERPNext and LogicX in the disposable site');
 writeFileSync(directory+'/install.log',compose(['run','--rm','--no-deps','init']));
 console.log('Starting immutable runtime services');
 compose(['up','-d','--wait','--wait-timeout','240']);
 console.log(compose(['exec','-T','backend','env/bin/python','/opt/logicx/verify_runtime.py']));
 const code=`import json,urllib.request,http.cookiejar,re
jar=http.cookiejar.CookieJar()
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
req=urllib.request.Request('http://frontend:4445/api/method/login',data=json.dumps({'usr':'admin@tenant.com','pwd':'disposable-admin-only'}).encode(),headers={'Host':'logicx.localhost','Content-Type':'application/json'})
assert opener.open(req).status==200
page=opener.open(urllib.request.Request('http://frontend:4445/logicx-app',headers={'Host':'logicx.localhost'}))
html=page.read().decode()
assert page.status==200 and '/assets/logicx_app/frontend/assets/' in html
asset=re.search(r'src="([^"]+[.]js)"',html).group(1)
assert opener.open(urllib.request.Request('http://frontend:4445'+asset,headers={'Host':'logicx.localhost'})).status==200
assert opener.open(urllib.request.Request('http://frontend:4445/api/resource/LogicX%20Product?limit_page_length=1',headers={'Host':'logicx.localhost'})).status==200
socket=opener.open(urllib.request.Request('http://frontend:4445/socket.io/?EIO=4&transport=polling',headers={'Host':'logicx.localhost'}))
assert socket.read().decode().startswith('0{')
print('Administrator email login, LogicX page/API/assets and WebSocket proxy passed')
`;
 console.log(docker(['compose','-p',project,'-f',directory+'/compose.json','exec','-T','backend','env/bin/python','-'],code));
 passed=true;console.log('Disposable Frappe + ERPNext + LogicX integration passed');
}catch(error){
 if(error.stdout)writeFileSync(directory+'/failed.stdout',error.stdout);
 if(error.stderr)writeFileSync(directory+'/failed.stderr',error.stderr);
 try{writeFileSync(directory+'/services.log',compose(['logs','--no-color','--tail','100']));}catch{}
 console.error('Disposable integration failed; inspect ignored fixture logs in '+directory);
 console.error(String(error.stderr??error.message).slice(-5000));
 process.exitCode=1;
}finally{
 // Only this randomly named, explicitly created fixture is removed.
 if(passed){compose(['--profile','install','down','--volumes','--remove-orphans']);docker(['network','rm',infra]);}
}
