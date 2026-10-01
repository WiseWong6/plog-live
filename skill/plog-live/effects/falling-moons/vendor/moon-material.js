(function () {
  'use strict';
  const TAU = Math.PI * 2, SCALE = .9;
  const bodies = new Map();
  let glow = null, ready = false;
  const stats = { bodyBuilds: 0, glintBuilds: 0 };
  const smooth = x => { const t=Math.max(0,Math.min(1,x)); return t*t*(3-2*t); };

  // 从「星月来信」makeShape(kind==='moon') 原样移植四段曲线，
  // 仅统一缩至既有月牙保护半径；不能以两个重叠圆替换原素材。
  function outline(path, radius) {
    const r=radius*SCALE;
    path.moveTo(.48*r,-.96*r);
    path.bezierCurveTo(-.73*r,-1.06*r,-1.32*r,.13*r,-.62*r,.87*r);
    path.bezierCurveTo(-.13*r,1.4*r,.79*r,1.04*r,1.03*r,.38*r);
    path.bezierCurveTo(.33*r,.91*r,-.45*r,.27*r,-.33*r,-.34*r);
    path.bezierCurveTo(-.25*r,-.67*r,.08*r,-.89*r,.48*r,-.96*r);
    path.closePath();
  }
  function surface(radius, palette) {
    const path=new Path2D();outline(path,radius);
    // 只在加载时烘制本体。内存画布不写磁盘，也不编辑照片。
    const extent=Math.ceil(radius*1.1+2),density=2;
    const texture=document.createElement('canvas');
    texture.width=texture.height=extent*2*density;
    const g=texture.getContext('2d');g.setTransform(density,0,0,density,extent*density,extent*density);
    // 「花落成蝶」drawFallingSymbol 的固定金属底色做成清亮金黄，
    // 无灰绿、无随机锤纹；反光交给轮廓短亮纹，不逐帧重绘渐变面。
    const fill=g.createLinearGradient(-radius,radius,radius,-radius);
    fill.addColorStop(0,palette[1]);fill.addColorStop(.45,palette[0]);
    fill.addColorStop(.72,palette[2]);fill.addColorStop(1,'#daa62e');
    g.fillStyle=fill;g.fill(path);
    g.strokeStyle='#fff1ba';g.lineWidth=Math.max(.42,radius*.022);g.lineJoin='round';g.stroke(path);
    stats.bodyBuilds++;
    return {path,texture,extent,radius};
  }
  // 从「星月来信」glintTexture 移植：一次性缓存白亮核、两根尖细光芒。
  // 去掉原版两根斜芒，缩到月牙实体内侧；不把照片铺成大光晕。
  function glintTexture() {
    const texture=document.createElement('canvas');texture.width=texture.height=160;
    const g=texture.getContext('2d');g.setTransform(2,0,0,2,80,80);
    const tint='255,236,179';
    const halo=g.createRadialGradient(0,0,0,0,0,6.5);
    halo.addColorStop(0,'#ffffff');halo.addColorStop(.16,`rgba(${tint},.95)`);
    halo.addColorStop(.42,`rgba(${tint},.3)`);halo.addColorStop(1,`rgba(${tint},0)`);
    g.fillStyle=halo;g.fillRect(-6.5,-6.5,13,13);
    for(const [angle,length] of [[.1,31.2],[Math.PI/2+.1,23.4]]) {
      g.save();g.rotate(angle);
      const ray=g.createLinearGradient(-length,0,length,0);
      ray.addColorStop(0,`rgba(${tint},0)`);ray.addColorStop(.25,`rgba(${tint},.5)`);
      ray.addColorStop(.45,'#ffffff');ray.addColorStop(.55,'#ffffff');
      ray.addColorStop(.75,`rgba(${tint},.5)`);ray.addColorStop(1,`rgba(${tint},0)`);
      g.fillStyle=ray;g.beginPath();g.moveTo(-length,0);
      g.quadraticCurveTo(-2,-.351,0,-1.3);g.quadraticCurveTo(2,-.351,length,0);
      g.quadraticCurveTo(2,.351,0,1.3);g.quadraticCurveTo(-2,.351,-length,0);g.fill();g.restore();
    }
    g.fillStyle='#ffffff';g.beginPath();g.arc(0,0,1.2,0,TAU);g.fill();
    stats.glintBuilds++;return texture;
  }
  function prepare(flakes,width,palette) {
    if(ready)throw new Error('月牙缓存只能在加载时建立一次。');
    for(const f of flakes){const radius=f.radius*width;if(!bodies.has(radius))bodies.set(radius,surface(radius,palette));}
    glow=glintTexture();ready=true;
  }
  function state(f,age,angle,width) {
    const tilt=Math.sin(age*.92+f.rotation*1.23)*.68;
    const reflection=Math.pow(Math.max(0,Math.cos((tilt-.12)*1.8)),8);
    return {tilt,reflection,scaleX:1,
      opacity:f.depth==='far'?.82:.96,
      // 光芒被缩到实体左肩附近，整体仍在原有月牙保护范围内。
      glint:smooth((reflection-.76)/.24)*.76,
      dashOffset:-age*f.radius*width*.65-f.rotation*f.radius*width,
      paintRadius:f.radius*width*1.065+width/1086};
  }
  function paint(ctx,r,m) {
    if(!ready||!bodies.has(r))throw new Error('月牙绘制前必须完成缓存。');
    const body=bodies.get(r),extent=body.extent;
    ctx.drawImage(body.texture,-extent,-extent,extent*2,extent*2);
    // 「星月来信」drawSymbol 的沿边短亮纹：每帧只有一条线，
    // 固定亮白与连续偏移，不重建渐变，不模糊整枚图形。
    ctx.save();ctx.globalCompositeOperation='screen';
    ctx.strokeStyle='#fff9df';ctx.globalAlpha*=.25+.47*m.reflection;
    ctx.lineWidth=Math.max(.72,r*.04);ctx.lineJoin='round';ctx.lineCap='round';
    ctx.setLineDash([r*.58,r*8]);ctx.lineDashOffset=m.dashOffset;ctx.stroke(body.path);ctx.restore();
    if(m.glint>.015){
      const side=80*r*.32/31.2;
      ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha*=m.glint;
      ctx.drawImage(glow,-r*.60-side/2,-r*.20-side/2,side,side);ctx.restore();
    }
  }
  window.PlogMoonMaterial={prepare,state,outline,paint,cacheStats:()=>({...stats,ready})};
}());
