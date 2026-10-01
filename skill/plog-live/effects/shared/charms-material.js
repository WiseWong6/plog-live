/*
 * Adapted locally from 星月来信/animation.js: makeShape, glintTexture,
 * butterflySpread; and august-night-osmanthus/scene.js: symbolPath,
 * wingPath, buildWingAtlas, drawButterfly. Provenance: ../mixed-charms/vendor/SOURCES.md.
 * All surfaces are prepainted into bounded in-memory canvases; no frame-time
 * gradient/filter generation, external assets, or cross-project runtime link.
 */
(function () {
'use strict';
const TAU=Math.PI*2, UNIT=40, TILE=128;
const palettes={
 gold:{dark:'#8b6944',mid:'#d8b979',light:'#fff2cc',rim:'#fff8e5'},
 silver:{dark:'#8b8790',mid:'#d1cdd3',light:'#faf5fc',rim:'#fffaff'}
};
let surfaces=new Map(),glints=new Map(),anchors=new Map(),initialized=false;
const solidAnchors={moon:[-.62,-.18],star:[-.06,-.66],spark:[0,-.38],flower:[-.33,-.34],diamond:[-.22,-.34],butterfly:[.65,-.57]};
function canvas(size){const c=document.createElement('canvas');c.width=c.height=size;return c;}

// Original moon, diamond and four-lobed blossom outlines from 星月来信.
function shapePath(g,kind,r){
 g.beginPath();
 if(kind==='moon'){
  g.moveTo(.48*r,-.96*r);
  g.bezierCurveTo(-.73*r,-1.06*r,-1.32*r,.13*r,-.62*r,.87*r);
  g.bezierCurveTo(-.13*r,1.4*r,.79*r,1.04*r,1.03*r,.38*r);
  g.bezierCurveTo(.33*r,.91*r,-.45*r,.27*r,-.33*r,-.34*r);
  g.bezierCurveTo(-.25*r,-.67*r,.08*r,-.89*r,.48*r,-.96*r);
 }else if(kind==='flower'){
  g.moveTo(0,-.34*r);
  g.bezierCurveTo(.28*r,-1.28*r,1.28*r,-.28*r,.34*r,0);
  g.bezierCurveTo(1.28*r,.28*r,.28*r,1.28*r,0,.34*r);
  g.bezierCurveTo(-.28*r,1.28*r,-1.28*r,.28*r,-.34*r,0);
  g.bezierCurveTo(-1.28*r,-.28*r,-.28*r,-1.28*r,0,-.34*r);
 }else if(kind==='diamond'){
  g.moveTo(0,-r);g.lineTo(.62*r,0);g.lineTo(0,r);g.lineTo(-.62*r,0);
 }else{
  // The four/five-point solid and outline family from osmanthus symbolPath.
  const corners=kind==='spark'?4:5,inner=corners===4?.2:.43;
  for(let i=0;i<corners*2;i++){
   const a=-Math.PI/2+i*Math.PI/corners,n=i%2?r*inner:r;
   if(i===0)g.moveTo(Math.cos(a)*n,Math.sin(a)*n);else g.lineTo(Math.cos(a)*n,Math.sin(a)*n);
  }
 }
 g.closePath();
}

// Fore/hind wing geometry copied from 花落成蝶, preserving its scalloped hind wing.
function wingPath(g,n,hind){
 g.beginPath();g.moveTo(0,n*.04);
 if(hind){
  g.bezierCurveTo(n*.36,-n*.02,n*.80,n*.18,n*.76,n*.43);
  g.bezierCurveTo(n*.74,n*.55,n*.63,n*.66,n*.54,n*.66);
  g.bezierCurveTo(n*.49,n*.74,n*.41,n*.75,n*.36,n*.68);
  g.bezierCurveTo(n*.19,n*.68,n*.06,n*.29,0,n*.04);
 }else{
  g.bezierCurveTo(n*.20,-n*.43,n*.64,-n*.98,n*.90,-n*.98);
  g.bezierCurveTo(n*.99,-n*.98,n,-n*.89,n,-n*.72);
  g.bezierCurveTo(n*.97,-n*.42,n*.73,-n*.10,n*.42,n*.06);
  g.bezierCurveTo(n*.23,n*.13,n*.08,n*.12,0,n*.04);
 }
 g.closePath();
}

function surface(kind,material,outline,bright){
 const c=canvas(TILE),g=c.getContext('2d'),p=palettes[material],r=UNIT;
 g.translate(TILE/2,TILE/2);g.lineJoin='round';g.lineCap='round';
 const wing=kind==='wing',path=()=>wing?[true,false].forEach(h=>wingPath(g,r,h)):shapePath(g,kind,r);
 const grad=g.createLinearGradient(-r,-r,r*.8,r);
 grad.addColorStop(0,p.light);grad.addColorStop(.26,bright?p.rim:p.mid);
 grad.addColorStop(.52,bright?p.light:p.mid);grad.addColorStop(.68,p.dark);grad.addColorStop(1,p.mid);
 if(wing){
  for(const hind of [true,false]){
   wingPath(g,r,hind);g.fillStyle=grad;g.fill();g.strokeStyle=p.rim;g.lineWidth=.9;g.stroke();
   g.save();wingPath(g,r,hind);g.clip();g.strokeStyle=bright?p.rim:p.light;g.globalAlpha=.38;g.lineWidth=.65;
   g.beginPath();g.moveTo(r*.04,0);g.quadraticCurveTo(r*.37,-r*.48,r*.87,-r*.88);
   g.moveTo(r*.04,0);g.quadraticCurveTo(r*.47,-r*.19,r*.91,-r*.54);
   g.moveTo(r*.03,r*.08);g.quadraticCurveTo(r*.34,r*.14,r*.65,r*.43);g.stroke();g.restore();
  }
 }else{
  path();g.fillStyle=grad;g.strokeStyle=grad;g.lineWidth=outline?4.4:1.0;
  if(outline)g.stroke();else g.fill();
  path();g.strokeStyle=p.rim;g.lineWidth=outline?1.3:.8;g.globalAlpha=bright?.94:.54;g.stroke();
  if(bright&&!outline){
   g.save();path();g.clip();
   const shine=g.createLinearGradient(-r,0,r,0);
   shine.addColorStop(0,'rgba(255,255,255,0)');shine.addColorStop(.35,'rgba(255,255,255,0)');
   shine.addColorStop(.46,'rgba(255,255,255,.86)');shine.addColorStop(.54,'rgba(255,255,255,.92)');
   shine.addColorStop(.66,'rgba(255,255,255,0)');shine.addColorStop(1,'rgba(255,255,255,0)');
   g.fillStyle=shine;g.fillRect(-r*1.35,-r*1.4,r*2.7,r*2.8);g.restore();
  }
 }
 return c;
}

// White core + unequal fine rays + compact halo, adapted from 星月来信 glintTexture.
function glintTexture(material){
 const c=canvas(160),g=c.getContext('2d');g.setTransform(2,0,0,2,80,80);
 const tint=material==='gold'?'255,238,189':'255,249,255';
 const halo=g.createRadialGradient(0,0,0,0,0,6.5);
 halo.addColorStop(0,'#ffffff');halo.addColorStop(.16,`rgba(${tint},.95)`);
 halo.addColorStop(.42,`rgba(${tint},.3)`);halo.addColorStop(1,`rgba(${tint},0)`);
 g.fillStyle=halo;g.fillRect(-6.5,-6.5,13,13);
 for(const [angle,length,gain]of[[.1,31.2,1],[Math.PI/2+.1,23.4,1],[Math.PI/4+.1,13.4,.38],[Math.PI*.75+.1,13.4,.38]]){
  g.save();g.rotate(angle);g.globalAlpha=gain;const ray=g.createLinearGradient(-length,0,length,0);
  ray.addColorStop(0,`rgba(${tint},0)`);ray.addColorStop(.25,`rgba(${tint},.5)`);ray.addColorStop(.45,'#ffffff');ray.addColorStop(.55,'#ffffff');ray.addColorStop(.75,`rgba(${tint},.5)`);ray.addColorStop(1,`rgba(${tint},0)`);
  g.fillStyle=ray;g.beginPath();g.moveTo(-length,0);g.quadraticCurveTo(-2,-.35,0,-1.3);g.quadraticCurveTo(2,-.35,length,0);g.quadraticCurveTo(2,.35,0,1.3);g.quadraticCurveTo(-2,.35,-length,0);g.fill();g.restore();
 }
 g.fillStyle='#ffffff';g.beginPath();g.arc(0,0,1.6,0,TAU);g.fill();return c;
}
// Outline pieces reflect at their actual rim, never at the empty centre.
// Project the desired anchor onto the real path once during initialization.
function outlineAnchor(kind,wanted){
 const points=[];let start,x=0,y=0;
 const push=(a,b)=>{x=a;y=b;points.push([a,b]);};
 const recorder={beginPath(){},moveTo(a,b){start=[a,b];push(a,b);},lineTo:push,
  closePath(){push(...start);},bezierCurveTo(cx,cy,dx,dy,ex,ey){
   const sx=x,sy=y;
   for(let i=1;i<=1024;i++){const t=i/1024,u=1-t;
    push(u*u*u*sx+3*u*u*t*cx+3*u*t*t*dx+t*t*t*ex,u*u*u*sy+3*u*u*t*cy+3*u*t*t*dy+t*t*t*ey);
   }
  }};
 shapePath(recorder,kind,1);let best=Infinity,answer=null;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;
  const t=den?Math.max(0,Math.min(1,((wanted[0]-a[0])*dx+(wanted[1]-a[1])*dy)/den)):0;
  const p=[a[0]+dx*t,a[1]+dy*t],distance=Math.hypot(p[0]-wanted[0],p[1]-wanted[1]);
  if(distance<best){best=distance;answer=p;}
 }
 return Object.freeze(answer);
}
function initialize(items){
 if(initialized)return;
 for(const item of items){
  const kind=item.kind==='butterfly'?'wing':item.kind,key=`${kind}/${item.material}/${Boolean(item.outline)}`;
  if(!surfaces.has(key))surfaces.set(key,[surface(kind,item.material,item.outline,false),surface(kind,item.material,item.outline,true)]);
  const anchorKey=`${item.kind}/${Boolean(item.outline)}`;
  if(!anchors.has(anchorKey))anchors.set(anchorKey,item.outline?outlineAnchor(item.kind,solidAnchors[item.kind]):Object.freeze([...solidAnchors[item.kind]]));
 }
 for(const material of ['gold','silver'])glints.set(material,glintTexture(material));initialized=true;
}
// Slightly asymmetric wing beat from 星月来信 butterflySpread; no random clock.
function butterflySpread(age,phase,side){
 const beat=age*(2.1+.25*Math.sin(phase))*TAU+phase+side*.07;
 return .24+.76*(.5+.5*Math.sin(beat));
}
function smooth(v){v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);}
function pose(age,seed){
 const t=age-1.40;
 const flash=t<0||t>.21?0:t<.04?smooth(t/.04):t<.075?1:1-smooth((t-.075)/.135);
 return {shine:.10+.62*Math.pow(Math.max(0,Math.cos((age-1.475)*1.35)),8),flash,
  left:butterflySpread(age,seed,-1),right:butterflySpread(age,seed,1)};
}
function tile(g,img,r){const s=TILE*r/UNIT;g.drawImage(img,-s/2,-s/2,s,s);}
function flashAnchor(item){
 const a=anchors.get(`${item.kind}/${Boolean(item.outline)}`);
 return item.kind==='butterfly'?[a[0]*item.light.right,a[1]]:a;
}
function draw(g,item,r){
 const wing=item.kind==='butterfly',key=`${wing?'wing':item.kind}/${item.material}/${Boolean(item.outline)}`,cached=surfaces.get(key);
 if(!cached)throw new Error('混合材质未预先缓存。');
 const light=item.light;
 if(wing){
  for(const side of [-1,1]){
   const spread=side===-1?light.left:light.right;g.save();g.scale(side*spread,1);
   tile(g,cached[0],r);g.globalAlpha*=Math.max(light.shine,Math.pow(spread,8)*.42);tile(g,cached[1],r);g.restore();
  }
  // Body stays on its axis while the cached fore/hind wings open and close.
  g.fillStyle=palettes[item.material].rim;g.beginPath();g.ellipse(0,r*.06,r*.055,r*.36,0,0,TAU);g.fill();
  g.strokeStyle=palettes[item.material].light;g.lineWidth=.6;g.beginPath();
  for(const side of [-1,1]){g.moveTo(0,-r*.28);g.quadraticCurveTo(side*r*.10,-r*.47,side*r*.23,-r*.51);}g.stroke();
 }else{
  tile(g,cached[0],r);g.save();g.globalAlpha*=light.shine;tile(g,cached[1],r);g.restore();
 }
 if(light.flash>.005){
  const a=flashAnchor(item);
  const size=r*2.35*(.78+.22*light.flash);g.save();g.globalAlpha*=light.flash;g.globalCompositeOperation='screen';
  g.drawImage(glints.get(item.material),a[0]*r-size/2,a[1]*r-size/2,size,size);g.restore();
 }
}
window.PlogCharmsMaterial={initialize,pose,draw,shapePath,wingPath,flashAnchor,
 stats:()=>({initialized,surfacePairs:surfaces.size,glintTextures:glints.size,anchorCount:anchors.size,canvasCount:surfaces.size*2+glints.size})};
}());
