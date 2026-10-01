#!/usr/bin/env node
import {readFile,writeFile,cp,mkdir,rm} from 'node:fs/promises';
import {resolve,join,extname,dirname} from 'node:path';
import vm from 'node:vm';
import {validateMotionLayout} from './motion-layout.mjs';
import {fileURLToPath} from 'node:url';
import {ROOT,readJSON,fileHash,dimensions,fitFrame,fresh,json} from './lib.mjs';
import {parseArgs,reportError} from './cli.mjs';
export async function templateConfig(id){const context={window:{}};vm.runInNewContext(await readFile(join(ROOT,'effects',id,'scene-config.js'),'utf8'),context,{timeout:1000});return JSON.parse(JSON.stringify(context.window.PLOG_CONFIG));}
export async function createScene({photo,effect,layout,out,live=false,frame}){
 const catalog=await readJSON(join(ROOT,'effects/catalog.json'));const selected=catalog.find(x=>x.id===effect);if(!selected)throw Error('未知或已删除的效果：'+effect);
 const spec=typeof layout==='string'?await readJSON(layout):layout;
 if(!spec?.reviewedForSource||spec.sourceSha256!==await fileHash(photo))throw Error('必须针对这张处理后照片重新布置效果，布局文件须包含正确的 sourceSha256 与 reviewedForSource:true。');
 if(!['screen','surface'].includes(spec.placement)||!spec.config||!Array.isArray(spec.subjectRegions)||!Array.isArray(spec.captionRegions))throw Error('布局必须说明 placement、主体区域、文字区域和完整 config。');
 if(live&&(spec.placement!=='screen'||['rain','glitter'].includes(effect)))throw Error('原 Live 的贴附效果尚无可靠跟随；请选择不依赖贴附跟随的全幅飘落或掠过。');
 if(live&&spec.motionPlan?.attachment==='cup')throw Error('杯中气泡属于贴附效果，原 Live 必须先有可靠杯口跟随。');
 if(live&&(!spec.reviewedWholeClip||spec.config.foregroundPath||spec.config.mintMask?.length))throw Error('原 Live 布局须检查整段运动和关键细节，并清除静态照片遮挡路径。');
 for(const r of [...spec.subjectRegions,...spec.captionRegions])if(!['x','y','width','height'].every(k=>Number.isFinite(r[k]))||r.x<0||r.y<0||r.width<=0||r.height<=0||r.x+r.width>1.001||r.y+r.height>1.001)throw Error('主体和文字区域须为照片内的0–1矩形');
 const base=await templateConfig(effect),meta=dimensions(photo),size=frame||fitFrame(meta.width,meta.height);
 if(Math.abs(size.width/size.height-meta.width/meta.height)>Math.max(2/size.height,2*size.width/size.height**2))throw Error('画布必须保持原照比例，不允许裁切。');
 validateMotionLayout(spec,effect);
 const c={...spec.config,...size,screenOnly:live||spec.placement==='screen',...(live?{foregroundPath:'',mintMask:[]}:{}),photo:'assets/source'+extname(photo).toLowerCase(),autoplay:false};
 if(c.effect!==base.effect)throw Error('配置与效果不匹配');
 await fresh(out);
 try{await cp(join(ROOT,'effects',effect),out,{recursive:true});for(const [destination,source] of Object.entries(selected.sharedFiles||{})){const target=join(out,destination);await mkdir(dirname(target),{recursive:true});await cp(join(ROOT,source),target);}await mkdir(join(out,'assets'),{recursive:true});await cp(photo,join(out,c.photo));
 await writeFile(join(out,'scene-config.js'),'window.PLOG_CONFIG = '+JSON.stringify(c,null,2)+';\n');
 await json(join(out,'source.json'),{sourceSha256:await fileHash(photo),original:meta,fullFrame:true,sourceCopied:true,layout:spec,effect});
 return{out,config:c};}catch(e){await rm(out,{recursive:true,force:true});throw e;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const a=parseArgs(process.argv.slice(2),['photo','effect','layout','out']);if(a.help){console.log('node create-scene.mjs --photo 原照 --effect 效果 --layout 布局.json --out 新目录');}else{for(const k of ['photo','effect','layout','out'])if(!a[k])throw Error('缺少 --'+k);console.log(JSON.stringify(await createScene({...a,photo:resolve(a.photo),out:resolve(a.out)}),null,2));}}catch(e){reportError(e);}}
