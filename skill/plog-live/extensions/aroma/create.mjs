import {readFile,writeFile,mkdir,cp,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join,extname} from 'node:path';
import {dimensions,fitFrame,fileHash,fresh} from '../../scripts/lib.mjs';
const root=dirname(fileURLToPath(import.meta.url));
export async function createAroma({photo,layout,out,live=false}){
 if(live)throw Error('香气贴附食物，需要可靠跟随后才能用于原实况，当前仅接受静态照片');
 const spec=typeof layout==='string'?JSON.parse(await readFile(layout,'utf8')):layout;
 if(!spec?.reviewedForSource||spec.sourceSha256!==await fileHash(photo))throw Error('先查看当前照片并绑定原图校验值');
 if(!spec.motionPlan||!['intent','anchor','direction','depth','overlap'].every(k=>typeof spec.motionPlan[k]==='string'&&spec.motionPlan[k].trim()))throw Error('需要为当前食物设计起点和动线');
 if(!Array.isArray(spec.origins)||spec.origins.length===0)throw Error('需要当前热食或饮品的散发区域');
 if(!Array.isArray(spec.config?.wisps)||!spec.config.wisps.length)throw Error('需要香气配置');
 for(const w of spec.config.wisps){if(!spec.origins.some(o=>o.rx>0&&o.ry>0&&((w.origin[0]-o.cx)/o.rx)**2+((w.origin[1]-o.cy)/o.ry)**2<=1))throw Error('香气须从当前食物或液面散发');}
 const original=dimensions(photo),size=fitFrame(original.width,original.height);await fresh(out);
 try{await cp(join(root,'template'),out,{recursive:true});await mkdir(join(out,'assets'),{recursive:true});const filename='assets/photo'+extname(photo);await cp(photo,join(out,filename));const config={...spec.config,...size,effect:'aroma',fps:30,photo:filename,autoplay:true,captionProtection:'local-fade',safeRects:spec.captionRegions||[]};
 await writeFile(join(out,'scene-config.js'),'window.PLOG_CONFIG = '+JSON.stringify(config,null,2)+';\n');await writeFile(join(out,'source.json'),JSON.stringify({effect:'aroma',sourceSha256:spec.sourceSha256,sourceCopied:true,fullFrame:true,original,layout:spec},null,2));return {out,config};}catch(e){await rm(out,{recursive:true,force:true});throw e;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const [photo,layout,out]=process.argv.slice(2);if(!photo||!layout||!out)throw Error('用法：node create.mjs 原图 布局 新输出目录');console.log(await createAroma({photo:resolve(photo),layout:resolve(layout),out:resolve(out)}));}catch(e){console.error(e.message);process.exitCode=1;}}
