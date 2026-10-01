// 布局验证：主体是空间关系，不是默认禁区。此检查不能代替观感验收。
export function validateMotionLayout(spec,effect){
 const p=spec.motionPlan,c=spec.config;
 if(!p||!['intent','anchor','direction','depth','overlap'].every(k=>typeof p[k]==='string'&&p[k].trim()))throw Error('先说明动效意图、画面支点、运动方向、前后层次和主体交叠，再填写坐标。');
 if(!Number.isFinite(c.duration)||c.duration<2||c.duration>12||c.fps!==30||!Number.isFinite(c.keyTime)||c.keyTime<0||c.keyTime>=c.duration||Math.abs(c.duration*30-Math.round(c.duration*30))>1e-7||Math.abs(c.keyTime*30-Math.round(c.keyTime*30))>1e-7)throw Error('动效周期须为2至12秒、30帧，封面落在完整帧上。');
 if(p.scope==='full-frame'){
  if(!c.flakes?.length)throw Error('全幅飘落需要粒子路径');
  const xs=c.flakes.map(f=>(f.from[0]+f.to[0])/2);
  if(Math.max(...xs)-Math.min(...xs)<.6)throw Error('全幅飘落不能收缩成边缘窄带。');
  const foreground=c.flakes.filter(f=>f.depth!=='far');
  if(!foreground.length)throw Error('全幅飘落需明确少量前层元素，不把全部元素藏在主体后面。');
  if(!foreground.some(f=>spec.subjectRegions.some(r=>Array.from({length:41},(_,i)=>i/40).some(u=>{const x=f.from[0]+(f.to[0]-f.from[0])*u,y=f.from[1]+(f.to[1]-f.from[1])*u;return x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height}))))throw Error('全幅方案没有任何前层路径经过主体，请复核是否又在整体避让。');
 }
 if(effect.startsWith('bubbles')&&p.attachment==='cup'){
  const mouths=p.origins;
  if(!Array.isArray(mouths)||!mouths.length||!mouths.every(e=>[e.cx,e.cy,e.rx,e.ry].every(Number.isFinite)&&e.rx>0&&e.ry>0))throw Error('杯中气泡必须记录当前照片的杯口椭圆。');
  if(!c.cupOrigin||!c.bubbles.every(b=>mouths.some(e=>((b.from[0]-e.cx)/e.rx)**2+((b.from[1]-e.cy)/e.ry)**2<=1.05)))throw Error('气泡起点必须在标注杯口内，不能从无关桌面冒出。');
 }
}
