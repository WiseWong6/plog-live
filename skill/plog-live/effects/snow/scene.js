(function () {
'use strict';
const EFFECT='snow';
function validateEffect(){
 if(!Array.isArray(config.flakes)||config.flakes.length<5||config.flakes.length>18)throw new Error('雪花数量需要五至九枚。');
 for(const p of config.flakes){if(![p.phase,p.radius,p.drift,p.opacity,p.rotation,...p.from,...p.to].every(Number.isFinite)||p.phase<0||p.phase>=config.duration||p.radius<.004||p.radius>.025||p.opacity<.2||p.opacity>1||p.from[1]>=-.02||p.to[1]<.5)throw new Error('雪花需要从画外落到食物后方。');}
}
function effectState(time){return {time,flakes:config.flakes.map(p=>{
 const u=wrap(time+p.phase)/config.duration;
 return {...p,u,x:p.from[0]+(p.to[0]-p.from[0])*u+Math.sin(u*Math.PI*2+p.rotation)*p.drift,y:p.from[1]+(p.to[1]-p.from[1])*u,angle:p.rotation+u*.7,radius:p.radius,envelope:p.radius+.002};
})};}
function particles(state){return state.flakes;}
function paintFlake(p){
 ctx.save();ctx.translate(placement.x+p.x*placement.width,placement.y+p.y*placement.height);ctx.rotate(p.angle);ctx.globalAlpha=p.opacity*window.PlogFlow.alpha(p,config,placement.width/placement.height);
 const r=p.radius*placement.width;ctx.strokeStyle=p.depth==='far'?'#c7cac3':'#e1ded0';ctx.lineWidth=(p.depth==='far'?.73:1.05)*placement.width/1086;ctx.lineCap='round';ctx.filter=p.depth==='far'?'blur(.45px)':'none';
 // 六枝细晶体，短支从主枝斜出；不使用圆点颗粒。
 ctx.beginPath();for(let branch=0;branch<6;branch++){const a=branch*Math.PI/3,c=Math.cos(a),s=Math.sin(a);ctx.moveTo(0,0);ctx.lineTo(c*r,s*r);for(const sign of [-1,1]){const branchA=a+sign*.84,outer=.54*r;ctx.moveTo(c*outer,s*outer);ctx.lineTo(c*outer+Math.cos(branchA)*r*.29,s*outer+Math.sin(branchA)*r*.29);}}ctx.stroke();
 ctx.fillStyle='#dfdac6';ctx.globalAlpha*=.65;ctx.beginPath();ctx.arc(0,0,ctx.lineWidth*.7,0,Math.PI*2);ctx.fill();ctx.restore();
}
function paintEffect(state){state.flakes.filter(p=>p.depth==='far').forEach(paintFlake);state.flakes.filter(p=>p.depth!=='far').forEach(paintFlake);}

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
const api=window.PlogScene={canvas,width:config.width,height:config.height,duration:config.duration,fps:config.fps,keyTime:config.keyTime,status:'loading',error:null,renderAt,getState,photoRect:()=>photo&&{x:0,y:0,width:photo.naturalWidth,height:photo.naturalHeight,destination:{...placement}},ready:null};
api.ready=Promise.resolve().then(async()=>{
 validate();photo=await loadImage(config.photo);const s=Math.min(config.width/photo.naturalWidth,config.height/photo.naturalHeight);placement={x:(config.width-photo.naturalWidth*s)/2,y:(config.height-photo.naturalHeight*s)/2,width:photo.naturalWidth*s,height:photo.naturalHeight*s};
 if(placement.x*2>=2||placement.y*2>=2)throw new Error('画布只能补不足两像素，不能裁切照片。');
 foreground=new Path2D(config.foregroundPath);
 // 完整采样路径包络，包括星片、泡泡或雪晶外缘，避免移动途中触碰英文。
 for(let i=0;i<900;i++){const state=getState(i/900*config.duration);for(const p of particles(state)){if(config.captionProtection!=='local-fade'&&!protectBounds(p,p.envelope))throw new Error('动效会触碰照片保护区。');}}
 canvas.width=config.width;canvas.height=config.height;canvas.style.aspectRatio=config.width+' / '+config.height;api.status='ready';renderAt(config.keyTime);return api;
}).catch(e=>{api.status='error';api.error=e.message;const n=document.getElementById('scene-error');if(n){n.textContent=e.message;n.hidden=false;}console.error('动效加载失败：',e);throw e;});api.ready.catch(()=>{});
}());
