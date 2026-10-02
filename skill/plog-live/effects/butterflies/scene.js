(function () {
'use strict';
const EFFECT='butterflies';
function validateEffect(){
 if(!window.PlogCharmsMaterial)throw new Error('缺少本地蝶翼材质。');
 if(!Array.isArray(config.flakes)||(config.flakes.length<3||config.flakes.length>10))throw new Error('蝴蝶掠过使用三至十只错开的蝴蝶。');
 for(const f of config.flakes){
  if(f.kind!=='butterfly'||(f.material!=='paper'||!/^#[0-9a-f]{6}$/i.test(f.color))||f.outline!==false)throw new Error('蝴蝶材质配置错误。');
  if(![f.phase,f.radius,f.drift,f.opacity,f.rotation,...f.from,...f.to].every(Number.isFinite)||f.phase<0||f.phase>=config.duration||f.radius<.007||f.radius>.03||f.opacity<.5||f.opacity>1||Math.abs(f.drift)>.015)throw new Error('蝴蝶尺寸、时间或轻摆参数无效；飞行方向由当前照片的路径决定。');
 }
 for(const f of config.flakes)if(f.control&&(!Array.isArray(f.control)||f.control.length!==2||!f.control.every(v=>Number.isFinite(v)&&v>=-.5&&v<=1.5)))throw new Error('蝴蝶转弯位置无效。');
 for(const f of config.flakes){const r=f.radius*1.55+.002,outside=p=>p[0]+r<0||p[0]-r>1||p[1]+r*config.width/config.height<0||p[1]-r*config.width/config.height>1;if(!outside(f.from)||!outside(f.to))throw new Error('蝶翼须在画外完整进入和离开。');}
 if(new Set(config.flakes.map(f=>f.id)).size!==config.flakes.length)throw new Error('蝴蝶名称不能重复。');
}
function effectState(time){return {time,flakes:config.flakes.map(f=>{
 const u=wrap(time+f.phase)/config.duration,age=u*config.duration;
 const wave=Math.sin(u*Math.PI*2+f.rotation)*f.drift;
 const control=f.control||[(f.from[0]+f.to[0])/2,(f.from[1]+f.to[1])/2];
 const point=window.PlogFlow.quadratic(f.from,control,f.to,u);
 const dx=(2*(1-u)*(control[0]-f.from[0])+2*u*(f.to[0]-control[0]))*config.width,dy=(2*(1-u)*(control[1]-f.from[1])+2*u*(f.to[1]-control[1])+Math.cos(u*Math.PI*2+f.rotation)*f.drift*Math.PI*2)*config.height;
 const light=window.PlogCharmsMaterial.pose(age,f.rotation);
 // 纸翼随拍动开合，沿用纸鸟的柔和折面，不发金属光。
 light.flash=0;
 return {...f,u,age,x:point[0],y:point[1]+wave,
  angle:Math.atan2(dy,dx)+Math.PI/2,light,envelope:f.radius*1.55+.002};
})};}
function particles(state){return state.flakes;}
function paintFlake(f){
 const r=f.radius*placement.width;
 if(f.y+f.envelope*placement.width/placement.height<0)return;
 ctx.save();ctx.translate(placement.x+f.x*placement.width,placement.y+f.y*placement.height);
 ctx.rotate(f.angle);ctx.globalAlpha=f.opacity*window.PlogFlow.alpha(f,config,placement.width/placement.height);
 window.PlogCharmsMaterial.draw(ctx,f,r);ctx.restore();
}
function paintEffect(state){
 state.flakes.filter(f=>f.depth==='far').forEach(paintFlake);
 state.flakes.filter(f=>f.depth!=='far').forEach(paintFlake);
}
const config=window.PLOG_CONFIG||{}, canvas=document.getElementById('scene'), ctx=canvas.getContext('2d',{alpha:false});
let photo,placement,foreground;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)), wrap=s=>((s%config.duration)+config.duration)%config.duration;
function validate(){
 if(!ctx)throw new Error('浏览器不支持画布。');
 for(const k of ['width','height'])if(!Number.isInteger(config[k])||config[k]<64||config[k]>4096||config[k]%2)throw new Error('画布宽高需要有效偶数。');
 if(!Number.isFinite(config.duration)||config.duration<2||config.duration>12||config.fps!==30||!Number.isFinite(config.keyTime)||config.keyTime<0||config.keyTime>=config.duration||Math.abs(config.duration*30-Math.round(config.duration*30))>1e-7||Math.abs(config.keyTime*30-Math.round(config.keyTime*30))>1e-7)throw new Error('时长须为2至12秒，封面对齐三十帧时间。');
 if(config.effect!==EFFECT)throw new Error('场景类型错误。');
 if(!config.foregroundPath&&!config.screenOnly)throw new Error('需要真实前景遮挡。');
 if(!Array.isArray(config.safeRects)||!config.safeRects.length)throw new Error('需要文字保护区。');
 config.safeRects.forEach(r=>{if(![r.x,r.y,r.width,r.height].every(Number.isFinite)||r.x<0||r.y<0||r.width<=0||r.height<=0||r.x+r.width>1||r.y+r.height>1)throw new Error('照片保护区越界。');});
 validateEffect();
}
function protectBounds(p,r){return !config.safeRects.some(b=>p.x+r>b.x&&p.x-r<b.x+b.width&&p.y+r*placement.width/placement.height>b.y&&p.y-r*placement.width/placement.height<b.y+b.height);}
function getState(seconds){if(!Number.isFinite(seconds))throw new TypeError('动画时间必须是有限数字。');return effectState(wrap(seconds));}
function drawPhoto(){ctx.drawImage(photo,0,0,photo.naturalWidth,photo.naturalHeight,placement.x,placement.y,placement.width,placement.height);}
function restoreFront(){ctx.save();ctx.translate(placement.x,placement.y);ctx.scale(placement.width,placement.height);ctx.clip(foreground);ctx.setTransform(1,0,0,1,0,0);drawPhoto();ctx.restore();}
function renderAt(seconds){
 if(api.status!=='ready')throw new Error('照片尚未准备好。');const state=getState(seconds);
 ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';ctx.fillStyle='#141515';ctx.fillRect(0,0,canvas.width,canvas.height);drawPhoto();
 ctx.save();ctx.beginPath();ctx.rect(placement.x,placement.y,placement.width,placement.height);ctx.clip();if(config.depthOcclusion==='far-only'){state.flakes.filter(p=>p.depth==='far').forEach(paintFlake);restoreFront();state.flakes.filter(p=>p.depth!=='far').forEach(paintFlake);}else{paintEffect(state);restoreFront();}ctx.restore();return canvas;
}
function loadImage(path){return new Promise((resolve,reject)=>{const img=new Image();img.onload=async()=>{try{if(img.decode)await img.decode();if(!img.naturalWidth||!img.naturalHeight)throw new Error('原图尺寸无效。');resolve(img);}catch(e){reject(e);}};img.onerror=()=>reject(new Error('照片读取失败。'));img.src=path;});}
const api=window.PlogScene={canvas,width:config.width,height:config.height,duration:config.duration,fps:config.fps,keyTime:config.keyTime,status:'loading',error:null,renderAt,getState,photoRect:()=>photo&&{x:0,y:0,width:photo.naturalWidth,height:photo.naturalHeight,destination:{...placement}},materialStats:()=>window.PlogCharmsMaterial.stats(),ready:null};
api.ready=Promise.resolve().then(async()=>{
 validate();photo=await loadImage(config.photo);const s=Math.min(config.width/photo.naturalWidth,config.height/photo.naturalHeight);placement={x:(config.width-photo.naturalWidth*s)/2,y:(config.height-photo.naturalHeight*s)/2,width:photo.naturalWidth*s,height:photo.naturalHeight*s};
 if(placement.x*2>=2||placement.y*2>=2)throw new Error('画布只能补不足两像素，不能裁切照片。');
 foreground=new Path2D(config.foregroundPath);window.PlogCharmsMaterial.initialize(config.flakes);
 // 完整采样蝶翼外缘及小幅飞行起伏，避免移动途中触碰英文。
 for(let i=0;i<900;i++){const state=getState(i/900*config.duration);for(const p of particles(state)){if(config.captionProtection!=='local-fade'&&!protectBounds(p,p.envelope))throw new Error('动效会触碰照片保护区。');}}
 canvas.width=config.width;canvas.height=config.height;canvas.style.aspectRatio=config.width+' / '+config.height;api.status='ready';renderAt(config.keyTime);return api;
}).catch(e=>{api.status='error';api.error=e.message;const n=document.getElementById('scene-error');if(n){n.textContent=e.message;n.hidden=false;}console.error('动效加载失败：',e);throw e;});api.ready.catch(()=>{});
}());
