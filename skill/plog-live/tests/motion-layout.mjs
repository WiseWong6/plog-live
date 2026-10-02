import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {validateMotionLayout,scatterFalling,fallingArrangementIssues,redirectFlight} from '../scripts/motion-layout.mjs';
import {templateConfig} from '../scripts/create-scene.mjs';
const regular={effect:'snow',duration:8,fps:30,keyTime:4,flakes:Array.from({length:8},(_,i)=>({from:[.05+i*.9/7,-.1],to:[.05+i*.9/7,1.1],phase:i,depth:i%3?'near':'far'}))};
assert(fallingArrangementIssues(regular).some(x=>x.includes('等距')));
const diagonal=structuredClone(regular);diagonal.flakes.forEach((f,i)=>{f.phase=8*(.08+i*.11+(i%2)*.025);f.from[0]=f.to[0]=-.1+1.2*f.phase/8;});
assert(fallingArrangementIssues(diagonal).some(x=>x.includes('直线')),'不等距的斜队列也应发现');
const config=scatterFalling(regular,'photo-a'),motionPlan={intent:'雪花飘过蛋糕',anchor:'中央蛋糕',direction:'全幅向下',depth:'少量在前',overlap:'允许过食物',scope:'full-frame'},spec={config,motionPlan,subjectRegions:[{x:.3,y:.3,width:.4,height:.5}]};
assert.deepEqual(config,scatterFalling(regular,'photo-a'));
assert.notDeepEqual(config,scatterFalling(regular,'photo-b'));
assert.deepEqual(regular.flakes.map(f=>f.phase),[0,1,2,3,4,5,6,7],'不改调用者原配置');
for(let seed=0;seed<50;seed++)assert.deepEqual(fallingArrangementIssues(scatterFalling(regular,'photo-'+seed)),[]);
validateMotionLayout(spec,'snow');
const narrow=structuredClone(spec);narrow.config.flakes.forEach(f=>{f.from[0]=.98;f.to[0]=1.1});assert.throws(()=>validateMotionLayout(narrow,'snow'),/窄带|直线/);
const far=structuredClone(spec);far.config.flakes.forEach(f=>f.depth='far');assert.throws(()=>validateMotionLayout(far,'snow'),/前层/);
const bubbles={...spec,motionPlan:{...motionPlan,scope:'scene-flow',attachment:'cup',origins:[{cx:.4,cy:.5,rx:.1,ry:.03}]},config:{duration:6,fps:30,keyTime:3,cupOrigin:true,bubbles:[{from:[.41,.50],to:[.45,-.1]}]}};
validateMotionLayout(bubbles,'bubbles');bubbles.config.bubbles[0].from=[.9,.9];assert.throws(()=>validateMotionLayout(bubbles,'bubbles'),/杯口/);
assert.throws(()=>validateMotionLayout({...spec,motionPlan:undefined},'snow'),/意图/);
const window={};vm.runInNewContext(await readFile(new URL('../scripts/flow-runtime.js',import.meta.url),'utf8'),{window});const a=window.PlogFlow;
const c={captionProtection:'local-fade',safeRects:[{x:.8,y:.1,width:.12,height:.04}]};assert.equal(a.alpha({x:.5,y:.5,radius:.02},c,1.5),1,'主体中央仍完整显示');assert.equal(a.alpha({x:.86,y:.12,radius:.02},c,1.5),0,'文字本身被保护');assert.equal(a.birth(0),0);assert.equal(a.birth(.1),1);
assert.deepEqual(Array.from(a.quadratic([0,0],[.5,1],[1,0],.5)),[.5,.5]);
for(const id of ['snow','falling-stars','falling-petals','falling-moons','mixed-charms'])assert.deepEqual(fallingArrangementIssues(await templateConfig(id)),[],id);
for(const id of ['birds','butterflies']){
 const base=await templateConfig(id);
 for(const direction of ['left-to-right','right-to-left','top-to-bottom','bottom-to-top']){
  const c=redirectFlight(base,direction);
  validateMotionLayout({...spec,config:c,motionPlan:{...motionPlan,scope:'scene-flow'}},id);
  const bad=structuredClone(c);bad.flightDirection=direction==='left-to-right'?'right-to-left':direction==='right-to-left'?'left-to-right':direction==='top-to-bottom'?'bottom-to-top':'top-to-bottom';
  assert.throws(()=>validateMotionLayout({...spec,config:bad},id),/方向不一致/);
 }
}
console.log('通过：飘落队列劣例、固定种子、模板分布、鸟蝶四向曲线、全幅覆盖、杯口出生及文字局部保护。');
