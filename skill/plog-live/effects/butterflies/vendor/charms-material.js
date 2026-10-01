/* 蝶翼轮廓来自花落成蝶；纸色、折面与拍翼节奏对齐本项目纸鸟。
 * 五张本地内存画布在加载时建立，播放时不创建渐变或图像文件。 */
(function () {
'use strict';
const TAU=Math.PI*2,UNIT=40,TILE=128,surfaces=new Map();
let initialized=false;
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

function initialize(items){
 if(initialized)return;
 for(const item of items){
  if(surfaces.has(item.color))continue;
  const c=document.createElement('canvas');c.width=c.height=TILE;
  const g=c.getContext('2d');g.translate(TILE/2,TILE/2);
  for(const hind of [true,false]){
   wingPath(g,UNIT,hind);g.fillStyle=item.color;g.fill();
   g.save();wingPath(g,UNIT,hind);g.clip();
   g.globalAlpha=.18;g.fillStyle='#fff1cf';g.beginPath();g.moveTo(0,UNIT*.04);
   g.lineTo(UNIT*(hind?.6:.86),UNIT*(hind?.43:-.86));g.lineTo(UNIT*.24,UNIT*(hind?.22:-.17));g.closePath();g.fill();g.restore();
  }
  surfaces.set(item.color,c);
 }
 initialized=true;
}
function pose(age,phase){
 const spread=side=>.24+.76*(.5+.5*Math.sin(TAU*(5/3)*age+phase+side*.07));
 return {shine:0,flash:0,left:spread(-1),right:spread(1)};
}
function draw(g,item,r){
 const image=surfaces.get(item.color);if(!image)throw new Error('纸蝶未完成缓存。');
 const s=TILE*r/UNIT;
 for(const side of [-1,1]){
  g.save();g.scale(side*(side===-1?item.light.left:item.light.right),1);
  g.drawImage(image,-s/2,-s/2,s,s);g.restore();
 }
 g.fillStyle=item.color;g.beginPath();g.ellipse(0,r*.06,r*.055,r*.36,0,0,TAU);g.fill();
 g.strokeStyle=item.color;g.lineWidth=.55;g.beginPath();
 for(const side of [-1,1]){g.moveTo(0,-r*.28);g.quadraticCurveTo(side*r*.10,-r*.47,side*r*.23,-r*.51);}g.stroke();
}
window.PlogCharmsMaterial={initialize,pose,draw,wingPath,
 stats:()=>({initialized,canvasCount:surfaces.size,paperColors:[...surfaces.keys()],glintTextures:0})};
}());
