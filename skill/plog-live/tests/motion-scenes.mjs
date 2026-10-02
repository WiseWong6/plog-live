// 用已有照片运行真实浏览器的时间函数与画布检查，不保存截图或视频。
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createScene,templateConfig} from '../scripts/create-scene.mjs';
import {redirectFlight} from '../scripts/motion-layout.mjs';
import {startChrome} from '../scripts/chrome-render.mjs';
import {fileHash,dimensions,fitFrame} from '../scripts/lib.mjs';
if(!process.argv[2])throw Error('用法：node tests/motion-scenes.mjs 已有照片的绝对路径');
const photo=resolve(process.argv[2]),directory=await mkdtemp(join(tmpdir(),'plog-motion-check-'));
const hash=await fileHash(photo),size=dimensions(photo),frame=fitFrame(size.width,size.height,480);
const browser=await startChrome();let count=0;
try{
 for(const effect of ['snow','falling-stars','falling-petals','falling-moons','mixed-charms','birds','butterflies']){
  const base=await templateConfig(effect),flying=['birds','butterflies'].includes(effect);
  for(const direction of flying?['left-to-right','right-to-left','top-to-bottom','bottom-to-top']:['falling']){
   const config=flying?redirectFlight(base,direction):base;
   config.screenOnly=true;config.foregroundPath='';config.mintMask=[];config.captionProtection='local-fade';
   const layout={sourceSha256:hash,reviewedForSource:true,placement:'screen',subjectRegions:[],captionRegions:[],motionPlan:{intent:'运动代码回归',anchor:'已有照片',direction,depth:'测试屏幕动效',overlap:'只检验时间和路径'},config};
   const scene=join(directory,effect+'-'+direction);
   await createScene({photo,effect,layout,out:scene,frame});
   await browser.command('Page.navigate',{url:pathToFileURL(join(scene,'index.html')).href});
   await browser.evaluate(`new Promise((resolve,reject)=>{const end=Date.now()+15000;function check(){if(window.PlogScene){PlogScene.ready.then(()=>resolve(true),reject);return}if(Date.now()>end)return reject(Error('初始化超时'));setTimeout(check,30)}check()})`);
   const result=await browser.evaluate(`(()=>{
    const p=PlogScene,c=PLOG_CONFIG,hash=t=>{p.renderAt(t);return p.canvas.toDataURL()},first=hash(0),middle=hash(p.duration*.43),loop=hash(p.duration),again=hash(0);
    const findings={deterministic:first===again,loop:first===loop,motion:first!==middle,heading:true,travel:true};
    const tracks=c.birds||c.flakes;
    if(c.effect==='birds'||c.effect==='butterflies')for(const f of tracks){
     const time=u=>((u*c.duration-f.phase)%c.duration+c.duration)%c.duration;
     const state=u=>{const s=p.getState(time(u));return (s.birds||s.flakes).find(x=>x.id===f.id)};
     const a=state(.15),b=state(.85),axis=['left-to-right','right-to-left'].includes(c.flightDirection)?'x':'y',sign=['left-to-right','top-to-bottom'].includes(c.flightDirection)?1:-1;
     findings.travel&&=(b[axis]-a[axis])*sign>.1;
     for(const u of [.2,.5,.8]){const a=state(u-.00001),b=state(u+.00001),m=state(u);const expected=Math.atan2((b.y-a.y)*c.height,(b.x-a.x)*c.width)+(c.effect==='butterflies'?Math.PI/2:0);findings.heading&&=Math.abs(Math.atan2(Math.sin(m.angle-expected),Math.cos(m.angle-expected)))<.001;}
    }
    return findings;
   })()`);
   for(const [name,value] of Object.entries(result))assert.equal(value,true,effect+' '+direction+' '+name);
   count++;
  }
 }
 console.log('通过：'+count+' 种真实场景，包括五种飘落、鸟蝶各四向；循环、重播、可见运动、位移与身体朝向一致。未进行观感或手机验收。');
}finally{await browser.close();await rm(directory,{recursive:true,force:true});}
