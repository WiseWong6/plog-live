import {mkdir,cp,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {ROOT,readJSON,json,fileHash,dimensions,fitFrame,run} from './lib.mjs';
import {createScene,templateConfig} from './create-scene.mjs';
import {inspectScene} from './scene-inspect.mjs';
import {photoPrompt} from './photo-prompt.mjs';
if(!process.argv[2]||!process.argv[3])throw Error('用法：node test-bundle.mjs 包含scenes的回归样片库 新检查目录');
const project=resolve(process.argv[2]),base=resolve(process.argv[3]);
await mkdir(base,{recursive:true});const rows=[];
for(const effect of await readJSON(join(ROOT,'effects/catalog.json'))){const dir=join(project,'scenes',effect.id),photo=join(dir,'assets/photo.png'),config=await templateConfig(effect.id),d=dimensions(photo),layout={sourceSha256:await fileHash(photo),reviewedForSource:true,placement:'surface',subjectRegions:[],captionRegions:[],motionPlan:{intent:'已有样片代码回归',anchor:'已有样片支点',direction:'保留基线轨迹',depth:'保留基线遮挡',overlap:'回归测试，不作为新照片布局'},config};
 layout.placement=config.screenOnly?'screen':'surface';
 const scene=join(base,effect.id);await createScene({photo,effect:effect.id,layout,out:scene,frame:fitFrame(d.width,d.height,480)});
 const report=await inspectScene(scene);rows.push({id:effect.id,...report.validation,flashTimes:report.flashTimes});await json(join(scene,'inspection.json'),report);console.log(effect.id,JSON.stringify(report.validation));
 if(!report.validation.deterministic||!report.validation.loop||!report.validation.motion)throw Error('效果检查未通过：'+effect.id);
}
await json(join(base,'report.json'),{rows,scope:'使用已有样片进行代码和画布时间采样，未截图、未实际界面验收，非新的盲测。'});
await photoPrompt('A little pause.');
