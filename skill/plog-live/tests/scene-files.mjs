import assert from 'node:assert/strict';
import {mkdtemp,readFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {ROOT,readJSON,fileHash} from '../scripts/lib.mjs';
import {createScene,templateConfig} from '../scripts/create-scene.mjs';
if(!process.argv[2])throw Error('用法：node tests/scene-files.mjs 已有照片的绝对路径');
const photo=resolve(process.argv[2]),directory=await mkdtemp(join(tmpdir(),'plog-scene-check-'));
const sha256=await fileHash(photo),catalog=await readJSON(join(ROOT,'effects/catalog.json'));
try {
 for(const effect of catalog){
  const config=await templateConfig(effect.id),out=join(directory,effect.id);
  const layout={sourceSha256:sha256,reviewedForSource:true,placement:'surface',subjectRegions:[],captionRegions:[],motionPlan:{intent:'制作文件回归检查',anchor:'保留样片支点',direction:'保留配置方向',depth:'保留配置层次',overlap:'保留配置交叠'},config};
  const created=await createScene({photo,effect:effect.id,layout,out});
  assert.equal(await fileHash(join(out,created.config.photo)),sha256);
  const html=await readFile(join(out,'index.html'),'utf8');
  for(const [,resource] of html.matchAll(/(?:src|href)=["']([^"']+)["']/g))if(!resource.startsWith('#')&&!resource.includes(':'))await access(join(out,resource));
  for(const [destination,source] of Object.entries(effect.sharedFiles||{}))assert.deepEqual(await readFile(join(out,destination)),await readFile(join(ROOT,source)));
  const assets=value=>typeof value==='string'&&value.startsWith('assets/')?[value]:value&&typeof value==='object'?Object.values(value).flatMap(assets):[];
  for(const asset of assets(created.config))await access(join(out,asset));
  if(effect.id==='rain')await assert.rejects(createScene({photo,effect:'rain',layout:{...layout,placement:'screen'},out:join(directory,'rejected-live'),live:true}),/可靠跟随/);
 }
 assert.equal(catalog.length,13);
 console.log('通过：十三种效果均生成独立场景，页面资源、公共文件、雨云雨滴素材完整，原图字节保持不变。');
} finally {await rm(directory,{recursive:true,force:true});}
