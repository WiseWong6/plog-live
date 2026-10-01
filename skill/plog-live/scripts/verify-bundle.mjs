import {readFile,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(join(root,'bundle-manifest.json'),'utf8'));
const expected=new Map(manifest.files.map(x=>[x.path,x.sha256])),actual=new Map();
async function visit(dir){for(const name of await readdir(dir)){const path=join(dir,name),rel=relative(root,path);if(rel==='native/.build'||name==='.DS_Store')continue;const s=await lstat(path);if(s.isSymbolicLink())throw Error('包内不允许软链接：'+rel);if(s.isDirectory())await visit(path);else if(rel!=='bundle-manifest.json')actual.set(rel,createHash('sha256').update(await readFile(path)).digest('hex'));}}
await visit(root);
const failures=[];
for(const [path,hash] of expected)if(actual.get(path)!==hash)failures.push(path+'（缺失或内容变化）');
for(const path of actual.keys())if(!expected.has(path))failures.push(path+'（清单外文件）');
if(failures.length)throw Error('发行包文件不一致：\n'+failures.join('\n'));
console.log(`发行包完整性通过：${actual.size} 个文件；不代表图片观感或手机验收。`);
