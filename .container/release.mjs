import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
export const contract=JSON.parse(readFileSync(path.join(root,'.container/release.json')));
const pkg=JSON.parse(readFileSync(path.join(root,'package.json')));
export function check(){
 if(contract.owner!=='apps/logicx-app'||contract.repository!=='CODEXSUN/logicx-app'||contract.target.hostPort!==14445||contract.target.containerPort!==4445||contract.target.binding!=='127.0.0.1')throw Error('Unexpected LogicX contract');
 for(const key of ['baseImage','frappeImage','redisImage'])if(!/@sha256:[a-f0-9]{64}$/.test(contract[key]))throw Error('Unpinned image');
 if((process.env.GITHUB_REF_NAME??'v-'+pkg.version)!=='v-'+pkg.version)throw Error('Release tag/version mismatch');
 execFileSync(process.env.PYTHON??'python',['-B','tools/version.py','check'],{cwd:root,stdio:'inherit'});
}
const isMain=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(isMain&&process.argv[2]==='check')check();
else if(isMain&&process.argv[2]==='manifest'){
 check();
 const {GITHUB_SHA:commit,RELEASE_IMAGE:image,RELEASE_DIGEST:digest,RELEASE_IMAGE_ID:imageId,RELEASE_ARCHIVE_SHA256:sha256}=process.env;
 if(!/^[a-f0-9]{40}$/.test(commit??'')||image!=='ghcr.io/codexsun/logicx-app'||!/^sha256:[a-f0-9]{64}$/.test(digest??'')||!/^sha256:[a-f0-9]{64}$/.test(imageId??'')||!/^[a-f0-9]{64}$/.test(sha256??''))throw Error('Invalid published image identity');
 const files=execFileSync('git',['ls-files','-z','logicx_app'],{cwd:root,encoding:'utf8'}).split('\0').filter(x=>/\/patches\/|\/doctype\/.*\.(json|py)$|patches\.txt$/.test(x));
 const frappeMigrations=Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(path.join(root,f))).digest('hex')]));
 writeFileSync(path.join(root,'release-manifest.json'),JSON.stringify({schema:1,owner:contract.owner,repository:contract.repository,version:pkg.version,tag:'v-'+pkg.version,commit,image:image+'@'+digest,imageId,archive:{name:'image.tar.gz',sha256},baseImage:contract.baseImage,frappeImage:contract.frappeImage,redisImage:contract.redisImage,dependencies:[],migrations:{},frappeMigrations,target:contract.target},null,2)+'\n');
}else if(isMain&&process.argv[2])throw Error('Use check or manifest');
