// 布局验证：主体是空间关系，不是默认禁区。此检查不能代替观感验收。
const fallingEffects=new Set(['snow','falling-stars','falling-moons','falling-petals','mixed-charms']);
const flightTurns={'left-to-right':0,'top-to-bottom':1,'right-to-left':2,'bottom-to-top':3};
const wrap=x=>((x%1)+1)%1;

// 只检查明显的等距时间和大部分粒子排成直线；不把自然观感简化为一个分数。
export function fallingArrangementIssues(c){
 const fs=c.flakes;
 if(!Array.isArray(fs)||fs.length<5||!Number.isFinite(c.duration)||c.duration<=0||fs.some(f=>!Number.isFinite(f.phase)||f.phase<0||f.phase>=c.duration||![...f.from,...f.to].every(Number.isFinite)))return ['飘落相位或路径无效'];
 const phases=fs.map(f=>f.phase/c.duration).sort((a,b)=>a-b),gaps=phases.map((p,i)=>wrap(phases[(i+1)%phases.length]-p));
 const issues=[];
 if(Math.max(...gaps)-Math.min(...gaps)<.12/fs.length)issues.push('飘落时间等距，容易出现整齐队列');
 for(const t of new Set([0,c.keyTime/c.duration,.23,.57,.81])){
  const points=fs.map(f=>{const u=wrap(t+f.phase/c.duration);return [f.from[0]+(f.to[0]-f.from[0])*u,f.from[1]+(f.to[1]-f.from[1])*u]}).filter(([x,y])=>x>=0&&x<=1&&y>=0&&y<=1);
  if(points.length<4)continue;
  const threshold=Math.max(4,Math.ceil(points.length*.75));
  let aligned=false;
  for(let i=0;i<points.length&&!aligned;i++)for(let j=i+1;j<points.length;j++){
   const [x,y]=points[i],[a,b]=points[j],dx=a-x,dy=b-y,length=Math.hypot(dx,dy);
   if(length<.25)continue;
   if(points.filter(([px,py])=>Math.abs(dx*(py-y)-dy*(px-x))/length<.022).length>=threshold){aligned=true;break;}
  }
  if(aligned)issues.push(`飘落在周期 ${t.toFixed(3)} 处大部分排成直线`);
 }
 return issues;
}

// 布局时一次性生成并保存相位。横向坐标不参与排序；播放期间不使用随机数。
export function scatterFalling(config,seed){
 if(!fallingEffects.has(config.effect)||typeof seed!=='string'||!seed.trim())throw Error('需要飘落配置和稳定种子（照片校验值）。');
 const c=structuredClone(config),n=c.flakes.length;
 let state=2166136261;
 for(const char of seed)state=Math.imul(state^char.charCodeAt(0),16777619)>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
 for(let attempt=0;attempt<256;attempt++){
  const phases=Array.from({length:n},(_,i)=>(i+.12+random()*.76)/n*c.duration);
  for(let i=n-1;i>0;i--){const j=Math.floor(random()*(i+1));[phases[i],phases[j]]=[phases[j],phases[i]];}
  c.flakes.forEach((f,i)=>{f.phase=Number(phases[i].toFixed(6));});
  if(!fallingArrangementIssues(c).length)return c;
 }
 throw Error('仅打散时间仍然排队，请重新布置横向坐标与路径。');
}

// 转动整条曲线而非只翻转造型；此工具用于画外进出的屏幕飞行。
export function redirectFlight(config,direction){
 if(!['birds','butterflies'].includes(config.effect)||!(direction in flightTurns)||!(config.flightDirection in flightTurns)||!config.screenOnly)throw Error('请选择屏幕飞行配置及明确的四向飞行方向。');
 const c=structuredClone(config),turns=(flightTurns[direction]-flightTurns[c.flightDirection]+4)%4;
 const rotate=point=>{let [x,y]=point;for(let i=0;i<turns;i++)[x,y]=[1-y,x];return [Number(x.toFixed(6)),Number(y.toFixed(6))]};
 for(const f of c.birds||c.flakes)for(const key of ['from','control','to'])if(f[key])f[key]=rotate(f[key]);
 c.flightDirection=direction;return c;
}

export function validateMotionLayout(spec,effect){
 const p=spec.motionPlan,c=spec.config;
 if(!p||!['intent','anchor','direction','depth','overlap'].every(k=>typeof p[k]==='string'&&p[k].trim()))throw Error('先说明动效意图、画面支点、运动方向、前后层次和主体交叠，再填写坐标。');
 if(!Number.isFinite(c.duration)||c.duration<2||c.duration>12||c.fps!==30||!Number.isFinite(c.keyTime)||c.keyTime<0||c.keyTime>=c.duration||Math.abs(c.duration*30-Math.round(c.duration*30))>1e-7||Math.abs(c.keyTime*30-Math.round(c.keyTime*30))>1e-7)throw Error('动效周期须为2至12秒、30帧，封面落在完整帧上。');
 if(fallingEffects.has(effect)){
  const issues=fallingArrangementIssues(c);
  if(issues.length)throw Error(issues.join('；')+'。请用 scatterFalling 打散时间，并复核首帧、封面与周期中段。');
 }
 if(['birds','butterflies'].includes(effect)){
  if(!(c.flightDirection in flightTurns)&&c.flightDirection!=='custom')throw Error('鸟蝶须按当前照片选择 flightDirection，不能默认沿用同一飞行方向。');
  const fs=c.birds||c.flakes;
  if(!Array.isArray(fs)||!fs.length)throw Error('鸟蝶缺少飞行路径。');
  const axis=flightTurns[c.flightDirection]%2,sign=flightTurns[c.flightDirection]<2?1:-1;
  if(c.flightDirection!=='custom'&&fs.some(f=>(f.to[axis]-f.from[axis])*sign<=.1))throw Error('飞行路径与声明方向不一致；请转动整条曲线。');
 }
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
