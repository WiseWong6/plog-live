(function () {
'use strict';
const EFFECT='bubbles-charms';
function validateEffect(){
 if(config.variant!=='charms'||!Array.isArray(config.bubbles)||config.bubbles.length!==6)throw new Error('星月轻泡需要六个原轨迹。');
 if(!Array.isArray(config.charms)||config.charms.length!==5||!material)throw new Error('需要五枚星月流光的现有素材。');
 const original=new Set(['moon/silver/false','star/gold/true','flower/silver/false','diamond/gold/true','spark/silver/false']);
 const occupied=new Set();for(const c of config.charms){if(!config.bubbles.some(b=>b.id===c.bubbleId)||occupied.has(c.bubbleId)||!original.has(`${c.kind}/${c.material}/${c.outline}`)||!Number.isFinite(c.reveal)||c.reveal<.05||c.reveal>.3)throw new Error('泡心素材配置无效。');occupied.add(c.bubbleId);}
 for(const p of config.bubbles){if(![p.phase,p.radius,p.drift,p.opacity,...p.from,...p.to].every(Number.isFinite)||p.phase<0||p.phase>=config.duration||p.radius<.009||p.radius>.028||p.opacity<=0||p.opacity>1||p.from[1]<=p.to[1]||'star' in p)throw new Error('纯气泡轨迹配置无效。');}
}
function effectState(time){return {time,bubbles:config.bubbles.map(p=>{
 const u=wrap(time+p.phase)/config.duration, rise=clamp(u/.94,0,1), pop=clamp((u-.94)/.06,0,1);
 const r=p.radius*(config.cupOrigin?(.30+.70*window.PlogFlow.birth(u)):(.86+.14*Math.sin(rise*Math.PI/2)));
 const charm=config.charms.find(c=>c.bubbleId===p.id), visibility=charm?smooth((u-charm.reveal)/.13)*(1-smooth((u-.79)/.13)):0;
 return {...p,u,charm:charm?{...charm,visibility}:null,x:p.from[0]+(p.to[0]-p.from[0])*rise+Math.sin(rise*Math.PI)*p.drift,y:p.from[1]+(p.to[1]-p.from[1])*rise,radius:r,pop,opacity:p.opacity*(1-pop)*(1-pop)*(config.cupOrigin?window.PlogFlow.birth(u):1),squash:1+.012*Math.sin(rise*Math.PI*2+p.phase),envelope:r*(pop?1.18:1.07)+.001};
})};}
function particles(state){return state.bubbles;}
function paintCharm(r,p){
 if(!p.charm||p.charm.visibility<=.001)return;
 ctx.save();
 // 泡膜轻微压缩只作用于气泡；逆变换使星月维持原素材的固定比例。
 ctx.scale(Math.sqrt(p.squash),1/Math.sqrt(p.squash));
 ctx.beginPath();ctx.arc(0,0,r*.78,0,Math.PI*2);ctx.clip();
 ctx.globalAlpha*=p.charm.visibility;
 const light=material.pose(1.12+p.u*.55,p.phase);
 material.draw(ctx,{...p.charm,light},r*.46);
 ctx.restore();
}
function paintBubble(p){
 const r=p.radius*placement.width, scale=placement.width/1086;
 ctx.save();ctx.translate(placement.x+p.x*placement.width,placement.y+p.y*placement.height);ctx.scale(1/Math.sqrt(p.squash),Math.sqrt(p.squash));ctx.globalAlpha=p.opacity*window.PlogFlow.alpha(p,config,placement.width/placement.height);
 if(p.pop===0){
  // 透明中心保留原照片；薄膜有浅虹彩和一明一暗的反射边。
  const membrane=ctx.createRadialGradient(0,0,r*.80,0,0,r*1.025);
  membrane.addColorStop(0,'rgba(233,245,250,0)');membrane.addColorStop(.55,'rgba(233,245,250,0)');membrane.addColorStop(.80,'rgba(176,222,242,.09)');membrane.addColorStop(.94,'rgba(229,241,250,.30)');membrane.addColorStop(1,'rgba(233,245,250,0)');
  ctx.fillStyle=membrane;ctx.beginPath();ctx.arc(0,0,r*1.025,0,Math.PI*2);ctx.fill();
  paintCharm(r,p);
  ctx.lineCap='round';
  // 窗光主亮弧；对侧细暗弧在浅背景上也能勾出泡膜。
  ctx.strokeStyle='rgba(255,255,249,.94)';ctx.lineWidth=2.55*scale;ctx.beginPath();ctx.arc(0,0,r*.963,-2.98,-1.37);ctx.stroke();
  ctx.strokeStyle='rgba(40,58,71,.44)';ctx.lineWidth=1.55*scale;ctx.beginPath();ctx.arc(0,0,r*.99,-.70,.70);ctx.stroke();
  ctx.strokeStyle='rgba(204,235,255,.67)';ctx.lineWidth=1.5*scale;ctx.beginPath();ctx.arc(0,0,r*.975,.56,1.52);ctx.stroke();
  ctx.strokeStyle='rgba(250,213,240,.59)';ctx.lineWidth=1.2*scale;ctx.beginPath();ctx.arc(0,0,r*.946,1.86,2.67);ctx.stroke();
  ctx.fillStyle='rgba(255,255,252,.94)';ctx.beginPath();ctx.ellipse(-r*.53,-r*.73,r*.12,r*.031,-.56,0,Math.PI*2);ctx.fill();
 }else{
  // 最高处仅留下三段极短薄膜，迅速破裂消散后才回到杯后。
  ctx.lineCap='round';ctx.lineWidth=1.2*scale;ctx.strokeStyle='rgba(248,250,255,.64)';
  for(const a of [-2.35,-.58,1.35]){ctx.beginPath();ctx.arc(0,0,r*(1+p.pop*.14),a,a+.16*(1-p.pop));ctx.stroke();}
 }
 ctx.restore();
}
function paintEffect(state){state.bubbles.slice().sort((a,b)=>a.radius-b.radius).forEach(paintBubble);}

const config=window.PLOG_CONFIG||{}, material=window.PlogCharmsMaterial, canvas=document.getElementById('scene'), ctx=canvas.getContext('2d',{alpha:false});
let photo,placement,foreground;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)), smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);}, wrap=s=>((s%config.duration)+config.duration)%config.duration;
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
 ctx.save();ctx.beginPath();ctx.rect(placement.x,placement.y,placement.width,placement.height);ctx.clip();paintEffect(state);ctx.restore();restoreFront();return canvas;
}
function loadImage(path){return new Promise((resolve,reject)=>{const img=new Image();img.onload=async()=>{try{if(img.decode)await img.decode();if(!img.naturalWidth||!img.naturalHeight)throw new Error('原图尺寸无效。');resolve(img);}catch(e){reject(e);}};img.onerror=()=>reject(new Error('照片读取失败。'));img.src=path;});}
const api=window.PlogScene={canvas,width:config.width,height:config.height,duration:config.duration,fps:config.fps,keyTime:config.keyTime,status:'loading',error:null,renderAt,getState,photoRect:()=>photo&&{x:0,y:0,width:photo.naturalWidth,height:photo.naturalHeight,destination:{...placement}},ready:null};
api.ready=Promise.resolve().then(async()=>{
 validate();photo=await loadImage(config.photo);const s=Math.min(config.width/photo.naturalWidth,config.height/photo.naturalHeight);placement={x:(config.width-photo.naturalWidth*s)/2,y:(config.height-photo.naturalHeight*s)/2,width:photo.naturalWidth*s,height:photo.naturalHeight*s};
 if(placement.x*2>=2||placement.y*2>=2)throw new Error('画布只能补不足两像素，不能裁切照片。');
 foreground=new Path2D(config.foregroundPath);material.initialize(config.charms);
 // 完整采样路径包络，包括泡膜和破裂短弧外缘，避免移动途中触碰英文。
 for(let i=0;i<900;i++){const state=getState(i/900*config.duration);for(const p of particles(state)){if(config.captionProtection!=='local-fade'&&!protectBounds(p,p.envelope))throw new Error('动效会触碰照片保护区。');}}
 canvas.width=config.width;canvas.height=config.height;canvas.style.aspectRatio=config.width+' / '+config.height;api.status='ready';renderAt(config.keyTime);return api;
}).catch(e=>{api.status='error';api.error=e.message;const n=document.getElementById('scene-error');if(n){n.textContent=e.message;n.hidden=false;}console.error('动效加载失败：',e);throw e;});api.ready.catch(()=>{});
}());
