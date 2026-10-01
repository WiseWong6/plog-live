(()=>{
'use strict';
const c=window.PLOG_CONFIG,canvas=document.getElementById('scene'),ctx=canvas.getContext('2d',{alpha:false});
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),wrap=t=>((t%c.duration)+c.duration)%c.duration;
let photo,rect;
function getState(t){if(!Number.isFinite(t))throw Error('时间必须为有限值');t=wrap(t);return {time:t,wisps:c.wisps.map((w,i)=>{const u=wrap(t+w.phase)/c.duration;return {...w,u,start:clamp(u*1.55-.64),end:clamp(u*1.55),alpha:Math.pow(Math.sin(Math.PI*u),1.15)*w.opacity,index:i};})};}
function point(w,s){const sway=Math.sin(s*8.2-w.u*Math.PI*2+w.index*1.8)*w.sway*Math.pow(s,.8);return {x:(w.origin[0]+w.drift*s+sway)*canvas.width,y:(w.origin[1]-w.height*s)*canvas.height};}
function paintWisp(w){
 if(w.end-w.start<.005||w.alpha<.001)return;
 // Feathered ribbon cross-section, drawn directly as transparent bands; the photo is never blurred.
 const pts=[];for(let k=0;k<=48;k++){const v=k/48,s=w.start+(w.end-w.start)*v,p=point(w,s);const taper=Math.pow(Math.sin(Math.PI*v),.7);pts.push({...p,r:w.width*canvas.width*(.24+.95*s)*taper,fade:taper*(1-.35*s)});}
 for(let band=-6;band<6;band++){
 const low=band/6,high=(band+1)/6,weight=Math.exp(-3.8*Math.pow((low+high)/2,2));
 for(let k=0;k<pts.length-1;k++){
 const a=pts[k],b=pts[k+1]; const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
 const norm={x:(a.x+b.x)/2/c.width,y:(a.y+b.y)/2/c.height,envelope:w.width};
 const protection=window.PlogFlow.alpha(norm,c,c.width/c.height);
 ctx.fillStyle=`rgba(255,247,230,${w.alpha*weight*(a.fade+b.fade)/2*protection})`;
 ctx.beginPath();ctx.moveTo(a.x+nx*a.r*low,a.y+ny*a.r*low);ctx.lineTo(b.x+nx*b.r*low,b.y+ny*b.r*low);ctx.lineTo(b.x+nx*b.r*high,b.y+ny*b.r*high);ctx.lineTo(a.x+nx*a.r*high,a.y+ny*a.r*high);ctx.closePath();ctx.fill();
 }
 }
}
function renderAt(t){if(api.status!=='ready')throw Error('照片未加载');const state=getState(t);ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle='#111515';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(photo,rect.x,rect.y,rect.width,rect.height);ctx.save();ctx.beginPath();ctx.rect(rect.x,rect.y,rect.width,rect.height);ctx.clip();state.wisps.forEach(paintWisp);ctx.restore();return canvas;}
const api=window.PlogScene={canvas,width:c.width,height:c.height,duration:c.duration,fps:30,keyTime:c.keyTime,status:'loading',renderAt,getState,photoRect:()=>photo&&{x:0,y:0,width:photo.naturalWidth,height:photo.naturalHeight,destination:rect},ready:null};
api.ready=(async()=>{
 if(c.effect!=='aroma'||!Number.isFinite(c.duration)||c.duration<4||c.duration>12||c.fps!==30)throw Error('香气需要4至12秒循环');
 if(!Array.isArray(c.wisps)||c.wisps.length<2||c.wisps.length>5)throw Error('香气保留2至5缕');
 for(const w of c.wisps){if(![...w.origin,w.phase,w.drift,w.height,w.sway,w.width,w.opacity].every(Number.isFinite)||w.origin.some(n=>n<0||n>1)||w.phase<0||w.phase>=c.duration||w.height<=0||w.height>.65||w.width<.002||w.width>.025||w.opacity<=0||w.opacity>.6)throw Error('香气布局参数不正确');}
 photo=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('照片读取失败'));i.src=c.photo;});
 const scale=Math.min(c.width/photo.naturalWidth,c.height/photo.naturalHeight);if(scale>1.000001)throw Error('不可放大原图');
 rect={x:(c.width-photo.naturalWidth*scale)/2,y:(c.height-photo.naturalHeight*scale)/2,width:photo.naturalWidth*scale,height:photo.naturalHeight*scale};if(rect.x>=1||rect.y>=1)throw Error('不可裁切或改变照片比例');
 canvas.width=c.width;canvas.height=c.height;canvas.style.aspectRatio=`${c.width}/${c.height}`;api.status='ready';renderAt(c.keyTime);return api;
})().catch(e=>{api.status='error';api.error=e.message;const el=document.getElementById('scene-error');el.hidden=false;el.textContent=e.message;throw e;});api.ready.catch(()=>{});
})();
