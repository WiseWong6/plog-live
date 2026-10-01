#!/usr/bin/env node
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOT,readJSON,json,run,probe,dimensions,fileHash,fresh} from './lib.mjs';
import {parseArgs,reportError} from './cli.mjs';
import {createScene} from './create-scene.mjs';
import {inspectScene} from './scene-inspect.mjs';
import {photoPrompt,photoRequest} from './photo-prompt.mjs';
import {renderFaces} from './render-faces.mjs';
import {verifyMotion} from './verify-motion.mjs';
import {videoPage,comparisonPage} from './delivery.mjs';
const native=join(ROOT,'scripts/live-photo.sh'),gradeTool=join(ROOT,'scripts/live-grade.sh');
const node=(script,args)=>run(process.execPath,[join(ROOT,'scripts',script),...args]);
function caption(s){if(!/^[A-Za-z][A-Za-z ,.'’!?-]*$/.test(s)||s.trim().split(/\s+/).length<2||s.trim().split(/\s+/).length>5)throw Error('英文默认2–5词；请先选定一句简短英文。');return s;}
export function checkVideo(p){const info=probe(p),v=info.streams.filter(x=>x.codec_type==='video');if(v.length!==1)throw Error('只支持单条主视频轨道');const s=v[0];if(info.streams.filter(x=>x.codec_type==='audio').length>1)throw Error('暂不支持多条原声音轨，未丢弃任何音轨');if(!Number.isFinite(+info.format.duration)||+info.format.duration<=0)throw Error('视频时长无效');if(!['h264','hevc'].includes(s.codec_name)||!['yuv420p','yuvj420p','nv12'].includes(s.pix_fmt)||['smpte2084','arib-std-b67'].includes(s.color_transfer)||String(s.color_primaries).includes('2020'))throw Error('暂不支持该编码或HDR视频；未自动降级。');if(Math.abs(+s.start_time||0)>.001)throw Error('暂不支持非零起始时间的原Live');if(+info.format.duration>15)throw Error('目前实况流程支持15秒内素材，未截短原视频');return info;}
export function checkLivePhoto(p){
 if(!['.jpg','.jpeg','.png'].includes(extname(p).toLowerCase()))throw Error('原Live封面暂仅支持8位sRGB或Display P3 JPEG/PNG；HEIC/HDR封面尚未验证，未自动转换。');
 const details=run('sips',['-g','profile','-g','space','-g','bitsPerSample',p]);
 if(!/bitsPerSample:\s*8\b/.test(details)||!/profile:\s*.*(?:sRGB|IEC61966-2.1|Display P3)/i.test(details)||!/space:\s*RGB\b/.test(details))throw Error('原Live封面暂仅支持明确标记的8位sRGB或Display P3，未静默改变色彩。');
 return {details};
}
async function freezeCheck(){await photoPrompt('A little pause.');}
export function soundPolicy(value='original'){if(!['original','mute'].includes(value))throw Error('声音策略仅支持 original（保留原声）或 mute（静音）；不提供新增音效');return value;}
export function selectImageProvider(args={},env=process.env){
 const host=args['image-host']??(env.CODEX_THREAD_ID?'codex':'other');
 if(!['codex','other'].includes(host))throw Error('图片处理环境须为 codex 或 other');
 if(env.CODEX_THREAD_ID&&host!=='codex')throw Error('当前在 Codex 内，只能使用宿主内置 image_gen.imagegen');
 if(!env.CODEX_THREAD_ID&&host==='codex')throw Error('当前不在 Codex 内：请确认平台实际可用的图片编辑工具，用 --image-host other --image-tool 实际工具名');
 const tool=args['image-tool']??(host==='codex'?'image_gen.imagegen':null);
 if(typeof tool!=='string'||!tool.trim()||tool!==tool.trim())throw Error('非 Codex 环境须先确认平台实际可用的图片编辑工具，并填写 --image-tool 实际工具名');
 if(host==='codex'&&tool!=='image_gen.imagegen')throw Error('Codex 静态修图仅允许 image_gen.imagegen，不降级到其他生图工具');
 return {host,tool};
}
export function validateImageProvenance(provider,provenance,env=process.env){
 const selected=selectImageProvider({'image-host':provider?.host,'image-tool':provider?.tool},env);
 if(!provenance||provenance.tool!==selected.tool||typeof provenance.toolCallId!=='string'||!provenance.toolCallId.trim())throw Error('图片来源必须记录所选工具及真实调用标识');
 if((provenance.host!==undefined&&provenance.host!==selected.host)||(selected.host==='other'&&provenance.host!=='other'))throw Error('图片来源记录的环境与任务不一致');
 return selected;
}
export async function prepare(a){
 a['motion-source']=a['motion-source']||'photo';
 if(!['photo','original'].includes(a['motion-source']))throw Error('动态来源须为 photo（默认照片装饰）或 original（明确保留原拍摄运动）');
 if(a['motion-source']==='original'&&!a.video)throw Error('保留原拍摄运动需要原视频；没有视频时请使用默认照片装饰版本');
 const useOriginal=a['motion-source']==='original';
 a.mode=a.mode||'motion';a.sound=soundPolicy(a.sound);
 if(!['style','motion'].includes(a.mode))throw Error('请选择一次模式：style（调色文案）或 motion（叠加动效）。');
 if((!a.photo&&!a.video)||!a.out)throw Error('需要照片或视频，以及 --out');
 const missingMotion=a['input-kind']==='live'&&!a.video;
 if(a.mode==='motion'&&!a.effect)throw Error('动效模式需要选择一个主要效果 --effect');
 const imageProvider=!useOriginal&&a['already-styled']!=='true'?selectImageProvider(a):null;
 await freezeCheck();let original=a.photo?resolve(a.photo):null;const directory=resolve(a.out),text=caption(a.caption||'A little pause.');
 let pair=null,inputProbe=null,photoProbe=null;const standalone=!original;
 if(a.video&&(useOriginal||standalone)){inputProbe=checkVideo(resolve(a.video));if(original&&useOriginal){photoProbe=checkLivePhoto(original);pair=JSON.parse(run(native,['verify','--photo',original,'--video',resolve(a.video)]));if(!pair.success)throw Error('原Live配对或苹果解码检查未通过。');}}
 await fresh(directory);await mkdir(join(directory,'input'));
 if(standalone){original=join(directory,'input/extracted-cover.png');const frame=JSON.parse(run(gradeTool,['frame',resolve(a.video),String(+inputProbe.format.duration/2),original]));pair={success:true,source:'standalone-video',file_pair:{duration_seconds:frame.duration,video_width:frame.width,video_height:frame.height,key_photo_marker:{seconds:frame.keyTime}},system_decode:{status:'not_applicable_input_is_video'}};}
 const d=dimensions(original);
 const photo='input/original'+extname(original).toLowerCase();await cp(original,join(directory,photo));let video=null;
 if(a.video){video='input/original'+extname(a.video).toLowerCase();if(video===photo)throw Error('照片与视频后缀冲突');await cp(resolve(a.video),join(directory,video));}
 const job={schema:3,inputNotice:missingMotion?'仅收到照片，按静态源制作装饰动态，未伪造原拍摄运动':null,kind:useOriginal?(standalone?'video':'live'):'photo',motionSource:useOriginal?'original':'photo',sourceKind:video?(standalone?'video':'live-resources'):'photo',sound:a.sound,mode:a.mode,effect:a.effect||null,caption:text,alreadyStyled:a['already-styled']==='true',input:{photo,video,sha256:await fileHash(original),videoSha256:a.video?await fileHash(resolve(a.video)):null,dimensions:d},pair,status:'prepared',createdAt:new Date().toISOString(),verification:{realLiveCapture:useOriginal&&!standalone,originalMotionRetained:useOriginal,iphone:false,xiaohongshu:false}};
 job.imageProvider=imageProvider;
 if(job.kind==='photo'&&!job.alreadyStyled){const request=await photoRequest(join(directory,photo),text,imageProvider);await writeFile(join(directory,'prompt.txt'),request.prompt);await json(join(directory,'image-tool-request.json'),request);job.style={id:request.style,templateSha256:request.templateSha256};job.status=imageProvider.host==='codex'?'awaiting_builtin_image_tool':'awaiting_image_tool';}
 if(pair)await json(join(directory,'input/pair-validation.json'),pair);
 if(inputProbe)await json(join(directory,'input/media-probe.json'),{photo:photoProbe,video:inputProbe});
 if(video&&!useOriginal)job.inputNotice='默认只使用照片（单独视频则取封面）调色生成装饰动效；原视频已归档，未混入原拍摄运动或原声，配对资源待可选原动态流程核验';
 await json(join(directory,'job.json'),job);return{job:directory,status:job.status,next:useOriginal?'检查整段主体/留白，提供 grade-layout.json，再执行 grade':'执行 grade 接收所选图片工具的结果；已调色照片可直接 grade'};
}
export async function grade(a){const dir=resolve(a.job),job=await readJSON(join(dir,'job.json'));if(job.styled)throw Error('本任务已经调色，防止重复处理');
 if(job.kind==='photo'){
  let result=join(dir,job.input.photo),provenance={type:'user-marked-already-styled'};
  if(!job.alreadyStyled){if(!a.result||!a.provenance)throw Error('需要图片编辑结果 --result 及真实工具来源记录 --provenance');provenance=await readJSON(resolve(a.provenance));validateImageProvenance(job.imageProvider,provenance);result=resolve(a.result);}
  const b=dimensions(result),s=job.input.dimensions;if(Math.abs(b.width/b.height-s.width/s.height)>.005)throw Error('结果改变了原图比例，需用所选图片工具重新处理，不自动裁边补救');
  await mkdir(join(dir,'styled'));const relative='styled/photo'+extname(result).toLowerCase();await cp(result,join(dir,relative));await json(join(dir,'styled/provenance.json'),provenance);job.styled={photo:relative};
 }else{
  if(job.alreadyStyled){await mkdir(join(dir,'styled'));const rel='styled/photo'+extname(job.input.photo);await cp(join(dir,job.input.photo),join(dir,rel));await cp(join(dir,job.input.video),join(dir,'styled/preview.mov'));job.styled={photo:rel,video:'styled/preview.mov',duration:job.pair.file_pair.duration_seconds,keyTime:job.pair.file_pair.key_photo_marker.seconds};}
  else{
   if(!a['grade-layout'])throw Error('原Live需要 --grade-layout，指定整段安全的英文位置和固定受光区域');
   const layout=await readJSON(resolve(a['grade-layout']));if(layout.sourceSha256!==job.input.sha256||layout.reviewedWholeClip!==true)throw Error('调色布局必须针对本段原Live，检查整段播放');
   const spec={...layout,photo:join(dir,job.input.photo),video:join(dir,job.input.video),caption:job.caption};await json(join(dir,'grade-spec.json'),spec);
   run(gradeTool,[join(dir,'grade-spec.json'),join(dir,'styled')]);
   const data=await readJSON(join(dir,'styled/native-report.json'));const p=probe(join(dir,job.input.video));const audio=p.streams.some(s=>s.codec_type==='audio');
   const args=['-hide_banner','-loglevel','error','-n','-i',join(dir,'styled/graded-silent.mov'),'-i',join(dir,job.input.video),'-map','0:v:0'];if(audio)args.push('-map','1:a:0');args.push('-c','copy','-bsf:v',`setts=pts=PTS:dts=DTS:duration='min(DURATION,${data.duration}/TB-PTS)'`,'-map_metadata','-1',join(dir,'styled/preview.mov'));run('ffmpeg',args);
   await json(join(dir,'styled/sequence-validation.json'),verifyMotion(join(dir,job.input.video),join(dir,'styled/preview.mov'),{dimensions:{width:data.width,height:data.height}}));
   job.styled={photo:'styled/cover.png',video:'styled/preview.mov',duration:data.duration,keyTime:job.pair.file_pair.key_photo_marker.seconds};
  }
 }
 if(a['face-layout']){if(job.kind!=='photo')throw Error('原Live贴附表情需要可靠跟随；当前不自动冻结视频');const f=await renderFaces(join(dir,job.styled.photo),resolve(a['face-layout']),join(dir,'styled/faces.png'));job.styled.photo='styled/faces.png';await json(join(dir,'styled/faces-report.json'),f);}
 job.status='styled';job.styled.sha256=await fileHash(join(dir,job.styled.photo));await json(join(dir,'job.json'),job);return{job:dir,photo:join(dir,job.styled.photo),sourceSha256:job.styled.sha256,next:job.mode==='motion'?'针对这张照片生成布局文件，再 finish --layout':'finish'};
}
export async function finish(a){const dir=resolve(a.job),job=await readJSON(join(dir,'job.json'));job.sound=soundPolicy(job.sound);if(!job.styled)throw Error('先执行 grade');if(job.status==='complete')throw Error('此任务已交付，不覆盖');const out=join(dir,'output');await fresh(out);
 let photo=join(dir,job.styled.photo),video=job.styled.video?join(dir,job.styled.video):null,keyTime=job.styled.keyTime,duration=job.styled.duration;
 if(job.mode==='style'&&job.kind==='photo'){
  await cp(join(dir,job.input.photo),join(out,'original'+extname(job.input.photo)));await cp(photo,join(out,'photo'+extname(photo)));await comparisonPage(out,'original'+extname(job.input.photo),'photo'+extname(photo));
 }else{
  if(job.mode==='motion'){
   if(!a.layout)throw Error('动效需要 --layout，不能沿用样片坐标');
   const frame=job.kind!=='photo'?{width:job.pair.file_pair.video_width,height:job.pair.file_pair.video_height}:undefined;
   const scene=await createScene({photo,effect:job.effect,layout:resolve(a.layout),out:join(dir,'scene'),live:job.kind!=='photo',frame});
   const inspect=await inspectScene(join(dir,'scene'),duration);await json(join(dir,'scene/inspection.json'),inspect);if(!inspect.validation.deterministic||!inspect.validation.loop||!inspect.validation.motion)throw Error('效果时序检查失败');
   duration=duration||scene.config.duration;keyTime=keyTime??scene.config.keyTime;
   const renderArgs=['--scene',join(dir,'scene'),'--out',join(dir,'render')];if(job.kind!=='photo')renderArgs.push('--overlay','true','--duration',String(duration),'--key-time',String(keyTime));node('render-scene.mjs',renderArgs);
   if(job.kind!=='photo'){
    // Extend only the overlay tail; the original video remains the timing master.
    // shortest=1 stops at its last frame, including variable-rate capture frames.
    run('ffmpeg',['-hide_banner','-loglevel','error','-n','-i',video,'-i',join(dir,'render/overlay.mov'),'-filter_complex','[1:v]tpad=stop_mode=clone:stop_duration=0.1[decor];[0:v][decor]overlay=shortest=1:eof_action=repeat:format=auto[v]','-map','[v]','-map','0:a?','-c:v','libx264','-crf','16','-pix_fmt','yuv420p','-c:a','copy','-fps_mode','passthrough','-enc_time_base','1:60000','-video_track_timescale','60000','-t',String(duration),'-map_metadata','-1',join(dir,'decorated.mov')]);video=join(dir,'decorated.mov');
    run(gradeTool,['overlay-cover',photo,join(dir,'render/cover.png'),join(out,'cover.png')]);photo=join(out,'cover.png');
   }else{video=join(dir,'render/preview.mp4');photo=join(dir,'render/cover.png');}
    // Keep original PCM/AAC in the deliverable MOV. Only the browser copy uses AAC.
    run('ffmpeg',['-hide_banner','-loglevel','error','-n','-i',video,'-map','0:v:0',...(job.sound==='mute'?[]:['-map','0:a?']),'-c','copy','-bsf:v',`setts=pts=PTS:dts=DTS:duration='min(DURATION,${duration}/TB-PTS)'`,'-map_metadata','-1',join(out,'preserved.mov')]);video=join(out,'preserved.mov');
    run('ffmpeg',['-hide_banner','-loglevel','error','-n','-i',video,'-map','0:v:0','-map','0:a?','-c:v','copy','-bsf:v',`setts=pts=PTS:dts=DTS:duration='min(DURATION,${duration}/TB-PTS)'`,'-c:a','aac','-b:a','192k','-movflags','+faststart',join(out,'preview.mp4')]);
    await json(join(out,'sound-report.json'),{strategy:job.sound,addedSound:false,originalTrackCopied:job.sound==='original'&&probe(video).streams.some(x=>x.codec_type==='audio'),previewAudio:'浏览器预览为AAC；配对MOV保留原音轨'});
  }else{
   if(job.sound==='mute'){run('ffmpeg',['-v','error','-n','-i',video,'-map','0:v:0','-c','copy',join(out,'preserved.mov')]);video=join(out,'preserved.mov');}
   run('ffmpeg',['-hide_banner','-loglevel','error','-n','-i',video,'-map','0:v:0','-map','0:a?','-c:v','copy','-bsf:v',`setts=pts=PTS:dts=DTS:duration='min(DURATION,${duration}/TB-PTS)'`,'-c:a','aac','-movflags','+faststart',join(out,'preview.mp4')]);
  }
  const cover='cover'+extname(photo);if(resolve(photo)!==join(out,cover))await cp(photo,join(out,cover));
  const report=JSON.parse(run(native,['pack','--photo',join(out,cover),'--video',video,'--output',join(out,'live-photo'),'--name','plog','--key-time',String(keyTime),'--preserve-key-time',String(job.kind==='live')]));await json(join(out,'live-validation.json'),report);
  if(!report.success)throw Error('苹果实况封装或系统解码失败');
  if(job.kind!=='photo')await json(join(out,'sequence-validation.json'),verifyMotion(join(dir,job.input.video),join(out,'live-photo/plog.mov'),{audio:job.sound,dimensions:{width:job.pair.file_pair.video_width,height:job.pair.file_pair.video_height}}));
  if(job.kind!=='photo'&&Math.abs(report.actual_key_time_seconds-keyTime)>.025)throw Error('输出封面时刻偏移，停止交付');
  const before='original'+extname(job.input.photo);await cp(join(dir,job.input.photo),join(out,before));
  await videoPage(out,'preview.mp4',cover,{before,offerOriginal:job.kind==='photo'&&!!job.input.video});
 }
 job.followUp=job.kind==='photo'&&job.mode==='motion'?{question:job.input.video?'这版是照片生成的装饰动效。是否另做保留原拍摄动作和原声的版本？':'这版是照片生成的装饰动效。是否需要保留原拍摄动作的版本？如有原视频可再提供。',originalAvailable:!!job.input.video,action:'仅用户确认后用归档原件、新任务目录及 --motion-source original 制作；不覆盖本版'}:null;
 job.status='complete';job.verification.framing='完整比例；视觉待验收';job.verification.audio=job.sound==='mute'?'静音':job.kind==='photo'?'照片装饰版无原声；归档视频未混入':'保留原声';await json(join(dir,'job.json'),job);await json(join(out,'receipt.json'),job);return{output:out,preview:join(out,'index.html'),validation:job.verification,followUp:job.followUp,transferReminder:job.mode==='style'&&job.kind==='photo'?null:'实况是 output/live-photo 内的 JPG＋MOV；导入苹果照片需明确授权，再由用户从照片应用自行隔空投送到 iPhone 验收。'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))try{const [command,...argv]=process.argv.slice(2),a=parseArgs(argv,['photo','video','mode','caption','out','input-kind','already-styled','effect','job','result','provenance','grade-layout','layout','face-layout','sound','motion-source','image-host','image-tool']);if(command==='prepare')console.log(JSON.stringify(await prepare(a),null,2));else if(command==='grade')console.log(JSON.stringify(await grade(a),null,2));else if(command==='finish')console.log(JSON.stringify(await finish(a),null,2));else if(command==='catalog')console.log(JSON.stringify(await readJSON(join(ROOT,'effects/catalog.json')),null,2));else if(command==='verify'){await freezeCheck();run(process.execPath,[join(ROOT,'scripts/verify-bundle.mjs')]);}else throw Error('用法：plog.mjs prepare|grade|finish|catalog|verify；详见 SKILL.md');}catch(e){reportError(e)}
