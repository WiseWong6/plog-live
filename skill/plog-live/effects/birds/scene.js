/* 照片固定。纸鸟沿当前照片选择的曲线飞行；身体随切线转向，画外接续或由真实物件遮挡。 */
(function () {
  'use strict';
  const config = window.PLOG_CONFIG;
  const canvas = document.getElementById('scene');
  const context = canvas.getContext('2d', {alpha:false});
  const tau = Math.PI * 2;
  const wrap = t => ((t % config.duration) + config.duration) % config.duration;
  let photo, placement;
  function number(value, low, high) { return Number.isFinite(value) && value >= low && value <= high; }
  function validate() {
    if (!context) throw new Error('浏览器不支持画布。');
    if(!Number.isFinite(config.duration)||config.duration<2||config.duration>12||config.fps!==30||!Number.isFinite(config.keyTime)||config.keyTime<0||config.keyTime>=config.duration||Math.abs(config.duration*30-Math.round(config.duration*30))>1e-7||Math.abs(config.keyTime*30-Math.round(config.keyTime*30))>1e-7)throw new Error('时长须为2至12秒，封面对齐三十帧时间。');
if(config.effect!=='birds')throw new Error('效果类型错误');
    for (const key of ['width','height']) if (!Number.isInteger(config[key]) || config[key] % 2 || !number(config[key],64,4096)) throw new Error('画布宽高须为有效偶数。');
    if (!number(config.keyTime,0,config.duration-1/config.fps) || Math.abs(config.keyTime*config.fps-Math.round(config.keyTime*config.fps))>1e-8) throw new Error('封面时间必须对齐完整帧。');
    if (!Array.isArray(config.birds) || config.birds.length<3 || config.birds.length>5) throw new Error('需三至五只飞鸟。');
    for (const b of config.birds) {
      if (!number(b.phase,0,config.duration-1e-6) || !number(b.size,.015,.07) || !number(b.flapPhase,0,1)) throw new Error('飞鸟尺寸或相位不正确。');
      for (const p of [b.from,b.control,b.to]) if (!Array.isArray(p) || p.length!==2 || !p.every(v=>number(v,-.2,1.2))) throw new Error('飞鸟轨迹坐标不正确。');
      const outside=p=>p[0]+b.size*.8<0||p[0]-b.size*.8>1||p[1]+b.size*.8*config.width/config.height<0||p[1]-b.size*.8*config.width/config.height>1;
      if(!outside(b.from)||(config.screenOnly&&!outside(b.to)))throw new Error('屏幕飞鸟须从画外进入并完整离开；贴附版须有真实遮挡。');
      if (!/^#[0-9a-f]{6}$/i.test(b.color)) throw new Error('飞鸟颜色无效。');
    }
    if (!config.screenOnly && (!Array.isArray(config.mintMask) || config.mintMask.length<3)) throw new Error('缺少薄荷叶遮挡轮廓。');
    for (const p of config.mintMask) if (!Array.isArray(p) || p.length!==2 || !p.every(v=>number(v,0,1))) throw new Error('薄荷叶轮廓无效。');
    const r=config.safeTextRect;
    if (!r || !['x','y','width','height'].every(k=>number(r[k],0,1)) || r.x+r.width>1 || r.y+r.height>1) throw new Error('英文保护区无效。');
  }
  function getState(seconds) {
    if (!Number.isFinite(seconds)) throw new TypeError('动画时间须为有限数字。');
    const time=wrap(seconds);
    return {time,birds:config.birds.map(b=>{
      const u=wrap(time+b.phase)/config.duration, v=1-u;
      const x=v*v*b.from[0]+2*v*u*b.control[0]+u*u*b.to[0];
      const y=v*v*b.from[1]+2*v*u*b.control[1]+u*u*b.to[1];
      const dx=2*v*(b.control[0]-b.from[0])+2*u*(b.to[0]-b.control[0]);
      const dy=2*v*(b.control[1]-b.from[1])+2*u*(b.to[1]-b.control[1]);
      const flap=Math.sin(tau*(5*u+b.flapPhase));
      return {id:b.id,u,x,y,angle:Math.atan2(dy*placement.height,dx*placement.width),flap,size:b.size,color:b.color,opacity:1};
    })};
  }
  function bird(b) {
    const s=b.size*placement.width;
    context.save();context.translate(placement.x+b.x*placement.width,placement.y+b.y*placement.height);context.rotate(b.angle);
    context.globalAlpha=.93*window.PlogFlow.alpha({...b,envelope:b.size*.6},config,placement.width/placement.height);context.fillStyle=b.color;
    // 两片折纸翅膀交替扇动；保持实心纸片轮廓，避免变成 V 字线条。
    const spread=.18+.37*(b.flap+1)/2;
    for (const side of [-1,1]) {
      context.beginPath();context.moveTo(.09*s,side*.065*s);
      context.bezierCurveTo(-.015*s,side*.21*s,-.27*s,side*spread*s,-.45*s,side*(spread+.025)*s);
      context.lineTo(-.19*s,side*.14*s);context.lineTo(-.26*s,side*.048*s);
      context.closePath();context.fill();
    }
    context.beginPath();context.moveTo(.28*s,0);context.lineTo(.135*s,-.061*s);
    context.quadraticCurveTo(-.035*s,-.13*s,-.23*s,-.047*s);
    context.lineTo(-.42*s,-.10*s);context.lineTo(-.35*s,0);context.lineTo(-.42*s,.10*s);
    context.lineTo(-.20*s,.044*s);context.quadraticCurveTo(.08*s,.12*s,.15*s,.03*s);context.closePath();context.fill();
    context.globalAlpha=.18;context.fillStyle='#fff1cf';
    context.beginPath();context.moveTo(.08*s,-.01*s);context.lineTo(-.25*s,-spread*s*.80);context.lineTo(-.15*s,-.07*s);context.closePath();context.fill();
    context.restore();
  }
  function renderAt(seconds) {
    if(api.status!=='ready') throw new Error('照片尚未加载。');
    const state=getState(seconds);
    context.setTransform(1,0,0,1,0,0);context.globalAlpha=1;context.globalCompositeOperation='source-over';
    context.fillStyle='#111515';context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(photo,0,0,photo.naturalWidth,photo.naturalHeight,placement.x,placement.y,placement.width,placement.height);
    context.save();context.beginPath();context.rect(placement.x,placement.y,placement.width,placement.height);context.clip();
    state.birds.forEach(bird);
    // 同一张完整原照片透过局部遮罩重画，纸鸟被真实薄荷叶挡住。
    context.save();context.beginPath();config.mintMask.forEach((p,i)=>context[i?'lineTo':'moveTo'](placement.x+p[0]*placement.width,placement.y+p[1]*placement.height));context.closePath();context.clip();
    context.drawImage(photo,0,0,photo.naturalWidth,photo.naturalHeight,placement.x,placement.y,placement.width,placement.height);
    context.restore();context.restore();return canvas;
  }
  const api=window.PlogScene={canvas,width:config.width,height:config.height,duration:config.duration,fps:config.fps,keyTime:config.keyTime,status:'loading',error:null,renderAt,getState,
    photoRect:()=>photo&&{x:0,y:0,width:photo.naturalWidth,height:photo.naturalHeight,destination:{...placement}},ready:null};
  api.ready=Promise.resolve().then(async()=>{
    validate();photo=await new Promise((resolve,reject)=>{const im=new Image();im.onload=async()=>{try{if(im.decode)await im.decode();if(!im.naturalWidth||!im.naturalHeight)throw new Error('照片尺寸无效。');resolve(im);}catch(e){reject(e);}};im.onerror=()=>reject(new Error('照片读取失败。'));im.src=config.photo;});
    const scale=Math.min(config.width/photo.naturalWidth,config.height/photo.naturalHeight);
    placement={x:(config.width-photo.naturalWidth*scale)/2,y:(config.height-photo.naturalHeight*scale)/2,width:photo.naturalWidth*scale,height:photo.naturalHeight*scale};
    if(placement.x*2>=2||placement.y*2>=2)throw new Error('只允许不足两像素补边，不能裁切照片。');
    canvas.width=config.width;canvas.height=config.height;canvas.style.aspectRatio=config.width+' / '+config.height;
    api.status='ready';renderAt(config.keyTime);return api;
  }).catch(error=>{api.status='error';api.error=error.message;const notice=document.getElementById('scene-error');if(notice){notice.textContent=error.message;notice.hidden=false;}console.error(error);throw error;});
  api.ready.catch(()=>{});
}());
