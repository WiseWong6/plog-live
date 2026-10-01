import {startChrome} from './chrome-render.mjs';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
export async function inspectScene(scene,duration){const b=await startChrome();try{
 await b.command('Page.navigate',{url:pathToFileURL(join(scene,'index.html')).href});
 await b.evaluate(`new Promise((resolve,reject)=>{const end=Date.now()+15000;function check(){if(window.PlogScene){PlogScene.ready.then(resolve,reject);return}if(Date.now()>end)return reject(Error('场景初始化超时'));setTimeout(check,30)}check()})`);
 return await b.evaluate(`(()=>{const p=PlogScene,d=${Number(duration)||'PlogScene.duration'},hash=t=>{p.renderAt(t);return p.canvas.toDataURL()},first=hash(0),loop=hash(p.duration),middle=hash(p.duration*.43),again=hash(0);let peaks=[],values=[];
 function flash(o){if(!o||typeof o!=='object')return 0;return Math.max(typeof o.flash==='number'?o.flash:0,...Object.values(o).filter(x=>x&&typeof x==='object').map(flash));}
 for(let i=0;i<Math.ceil(d*30);i++)values.push(flash(p.getState(i/30)));
 for(let i=1;i<values.length-1;i++)if(values[i]>.12&&values[i]>=values[i-1]&&values[i]>values[i+1]&&(peaks.length===0||i/30-peaks.at(-1)>.3))peaks.push(i/30);
 return{effect:PLOG_CONFIG.effect,duration:d,config:PLOG_CONFIG,flashTimes:peaks,validation:{deterministic:first===again,loop:first===loop,motion:first!==middle,fullPhotoRect:p.photoRect?.()}}})()`);
 }finally{await b.close()}}
