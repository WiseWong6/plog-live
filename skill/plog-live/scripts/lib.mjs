import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
export const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const fileHash=async p=>sha(await readFile(p));
export const readJSON=async p=>JSON.parse(await readFile(p,'utf8'));
export const json=async(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
export function run(bin,args,options={}){const r=spawnSync(bin,args,{encoding:'utf8',maxBuffer:12*1024*1024,...options});if(r.status!==0)throw Error(`${bin}: ${r.stderr||r.stdout||r.error}`);return r.stdout;}
export const probe=p=>JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',p]));
export function dimensions(p){return JSON.parse(run(resolve(ROOT,'scripts/live-grade.sh'),['image-info',p]));}
export function fitFrame(w,h,max=1920){if(![w,h,max].every(Number.isFinite)||Math.min(w,h)<64)throw Error('照片尺寸不足');const s=Math.min(1,max/Math.max(w,h));const width=Math.floor(w*s/2)*2,height=Math.floor(h*s/2)*2;if(Math.min(width,height)<64)throw Error('照片长宽比过于极端，缩小后不足64像素；未裁切或放大');return{width,height};}
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function fresh(p){await mkdir(dirname(p),{recursive:true});await mkdir(p);}
