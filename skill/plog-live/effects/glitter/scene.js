/* 星月碎光直接使用「星月流光」缓存的银色片面与闪光。 */
(function () {
  'use strict';
  const config=window.PLOG_CONFIG||{};
  const material=window.PlogCharmsMaterial;
  const canvas=document.getElementById('scene');
  const context=canvas.getContext('2d',{alpha:false});
  const wrap=t=>((t%config.duration)+config.duration)%config.duration;
  let photo,placement,starGlow,starGlint;
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};

  // 取自「星月来信」收尾星空：小范围发光底层叠清晰的亮核与尖芒。
  // 纹理只缓存一次，不对照片或银色片面做模糊处理。
  function makeStarGlow(){
    const image=document.createElement('canvas');image.width=image.height=48;
    const g=image.getContext('2d'),light=g.createRadialGradient(24,24,0,24,24,24);
    light.addColorStop(0,'rgba(255,255,255,.9)');light.addColorStop(.12,'rgba(230,241,255,.58)');
    light.addColorStop(.34,'rgba(153,193,255,.15)');light.addColorStop(1,'rgba(121,173,255,0)');
    g.fillStyle=light;g.fillRect(0,0,48,48);return image;
  }
  function makeStarGlint(){
    const image=document.createElement('canvas');image.width=image.height=160;
    const g=image.getContext('2d');g.setTransform(2,0,0,2,80,80);
    const halo=g.createRadialGradient(0,0,0,0,0,6.5);
    halo.addColorStop(0,'#ffffff');halo.addColorStop(.16,'rgba(255,255,255,.95)');
    halo.addColorStop(.42,'rgba(255,255,255,.3)');halo.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=halo;g.fillRect(-6.5,-6.5,13,13);
    for(const angle of [0,Math.PI/2]){
      const length=26,ray=g.createLinearGradient(-length,0,length,0);
      ray.addColorStop(0,'rgba(255,255,255,0)');ray.addColorStop(.25,'rgba(255,255,255,.5)');
      ray.addColorStop(.45,'#ffffff');ray.addColorStop(.55,'#ffffff');
      ray.addColorStop(.75,'rgba(255,255,255,.5)');ray.addColorStop(1,'rgba(255,255,255,0)');
      g.save();g.rotate(angle);g.fillStyle=ray;g.beginPath();g.moveTo(-length,0);
      g.quadraticCurveTo(-2,-1.25*.27,0,-1.25);g.quadraticCurveTo(2,-1.25*.27,length,0);
      g.quadraticCurveTo(2,1.25*.27,0,1.25);g.quadraticCurveTo(-2,1.25*.27,-length,0);
      g.fill();g.restore();
    }
    g.fillStyle='#ffffff';g.beginPath();g.arc(0,0,1.2,0,Math.PI*2);g.fill();return image;
  }
  function drawEmittedLight(item,r){
    const anchor=material.flashAnchor(item),x=anchor[0]*r,y=anchor[1]*r,flash=item.light.flash;
    const haloSize=r*2.6;
    context.save();context.globalCompositeOperation='screen';context.globalAlpha=.16+.68*flash;
    context.drawImage(starGlow,x-haloSize/2,y-haloSize/2,haloSize,haloSize);
    if(flash>.015){
      const glintSize=r*6.2*(.68+.32*smooth(flash));
      context.globalAlpha=flash;
      context.drawImage(starGlint,x-glintSize/2,y-glintSize/2,glintSize,glintSize);
    }
    context.restore();
  }

  function validate(){
    if(!context)throw new Error('浏览器不支持画布。');
    if(!material)throw new Error('星月流光银色素材未加载。');
    if(config.effect!=='glitter'||config.duration!==6||config.fps!==30||config.keyTime!==3)throw new Error('星月碎光应为六秒、每秒三十帧。');
    for(const key of ['width','height'])if(!Number.isInteger(config[key])||config[key]<64||config[key]>4096||config[key]%2)throw new Error('画布尺寸无效。');
    if(!Array.isArray(config.stars)||config.stars.length!==16)throw new Error('需要原位的十六枚亮片。');
    const text=config.safeTextRect;
    if(!text||!['x','y','width','height'].every(k=>Number.isFinite(text[k])&&text[k]>=0&&text[k]<=1)||text.x+text.width>1||text.y+text.height>1)throw new Error('英文保护区无效。');
    for(const s of config.stars){
      if(!['moon','flower','spark','star'].includes(s.shape))throw new Error('只使用星月流光已有的四种银色素材。');
      if(![s.x,s.y,s.size,s.angle,s.phase,s.plane].every(Number.isFinite)||s.x<0||s.x>1||s.y<0||s.y>1||s.size<.008||s.size>.03||s.phase<0||s.phase>=1||s.plane<.3||s.plane>1)throw new Error('亮片参数无效。');
      const radius=s.size*config.width*Math.sqrt(.76*s.plane),dx=(radius*2.25+2)/config.width,dy=(radius*2.25+2)/config.height;
      if(s.x-dx<0||s.x+dx>1||s.y-dy<0||s.y+dy>1)throw new Error('银色亮片或闪光越过照片边界。');
      if(s.x+dx>=text.x&&s.x-dx<=text.x+text.width&&s.y+dy>=text.y&&s.y-dy<=text.y+text.height)throw new Error('银色亮片或闪光碰到英文。');
    }
  }
  function getState(seconds){
    if(!Number.isFinite(seconds))throw new TypeError('动画时间须为有限数字。');
    const time=wrap(seconds);
    return {time,stars:config.stars.map((s,i)=>{
      // 六秒内每 1.2 秒错峰迎光；形状与位置保持不动。
      const cycle=(time+s.phase*config.duration)%1.2;
      const age=.8+cycle;
      const light=material.pose(age,s.angle);
      return {id:'fragment-'+(i+1),kind:s.shape,material:'silver',outline:false,
        x:s.x,y:s.y,radius:s.size*Math.sqrt(.76*s.plane),angle:s.angle,
        light:{...light,shine:.38+.62*Math.sin(Math.PI*cycle/1.2)**2}};
    })};
  }
  function renderAt(seconds){
    if(api.status!=='ready')throw new Error('照片尚未加载。');
    const state=getState(seconds);
    context.setTransform(1,0,0,1,0,0);context.globalAlpha=1;context.globalCompositeOperation='source-over';
    context.fillStyle='#111515';context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(photo,0,0,photo.naturalWidth,photo.naturalHeight,placement.x,placement.y,placement.width,placement.height);
    context.save();context.beginPath();context.rect(placement.x,placement.y,placement.width,placement.height);context.clip();
    for(const s of state.stars){
      context.save();context.translate(placement.x+s.x*placement.width,placement.y+s.y*placement.height);
      context.rotate(s.angle);
      const radius=s.radius*placement.width;
      // 银色片面仍用星月流光的原组件；发光取星月来信收尾的亮点叠层。
      material.draw(context,{...s,light:{...s.light,flash:0}},radius);
      drawEmittedLight(s,radius);context.restore();
    }
    context.restore();return canvas;
  }
  const api=window.PlogScene={canvas,width:config.width,height:config.height,duration:config.duration,fps:config.fps,keyTime:config.keyTime,status:'loading',error:null,renderAt,getState,materialStats:()=>material.stats(),photoRect:()=>photo&&{x:0,y:0,width:photo.naturalWidth,height:photo.naturalHeight,destination:{...placement}},ready:null};
  api.ready=Promise.resolve().then(async()=>{
    validate();photo=await new Promise((resolve,reject)=>{const im=new Image();im.onload=async()=>{try{if(im.decode)await im.decode();if(!im.naturalWidth||!im.naturalHeight)throw new Error('照片尺寸无效。');resolve(im);}catch(error){reject(error);}};im.onerror=()=>reject(new Error('照片读取失败。'));im.src=config.photo;});
    const scale=Math.min(config.width/photo.naturalWidth,config.height/photo.naturalHeight);
    placement={x:(config.width-photo.naturalWidth*scale)/2,y:(config.height-photo.naturalHeight*scale)/2,width:photo.naturalWidth*scale,height:photo.naturalHeight*scale};
    if(placement.x*2>=2||placement.y*2>=2)throw new Error('只允许不足两像素补边，不能裁切照片。');
    material.initialize(config.stars.map(s=>({kind:s.shape,material:'silver',outline:false})));
    starGlow=makeStarGlow();starGlint=makeStarGlint();
    canvas.width=config.width;canvas.height=config.height;canvas.style.aspectRatio=config.width+' / '+config.height;
    api.status='ready';renderAt(config.keyTime);return api;
  }).catch(error=>{api.status='error';api.error=error.message;const notice=document.getElementById('scene-error');if(notice){notice.textContent=error.message;notice.hidden=false;}console.error(error);throw error;});
  api.ready.catch(()=>{});
}());
