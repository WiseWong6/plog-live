// File-level verification; does not claim visual or iPhone acceptance.
import {probe,run,sha} from './lib.mjs';
function frames(path){return JSON.parse(run('ffprobe',['-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',path])).frames.map(f=>+f.best_effort_timestamp_time);}
function audioHash(path,samples){return sha(run('ffmpeg',['-v','error','-i',path,'-map','0:a:0','-af',`atrim=end_sample=${samples}`,'-f','s16le','-c:a','pcm_s16le','-'],{encoding:null,maxBuffer:128*1024*1024}));}
export function verifyMotion(input,output,{audio='original',dimensions}={}){
 if(!['original','mute'].includes(audio))throw Error('声音策略仅支持保留原声或静音');
 const a=probe(input),b=probe(output),at=frames(input),bt=frames(output),v=b.streams.find(s=>s.codec_type==='video');
 const maxFrameDelta=at.length===bt.length?Math.max(...at.map((t,i)=>Math.abs(t-bt[i]))):Infinity;
 const durationDelta=Math.abs(+a.format.duration-+b.format.duration);
 if(!at.length||at.length!==bt.length||maxFrameDelta>.002||durationDelta>.002)throw Error(`原动态时序发生变化：${at.length}/${bt.length}帧，时间偏差${maxFrameDelta}，时长偏差${durationDelta}`);
 if(dimensions&&(v.width!==dimensions.width||v.height!==dimensions.height))throw Error('输出显示尺寸变化');
 const aa=a.streams.filter(s=>s.codec_type==='audio'),ba=b.streams.filter(s=>s.codec_type==='audio');
 let originalAudio=null;
 if(audio==='original'){
  if(aa.length!==ba.length)throw Error('原声音轨丢失或出现新增声音');
  if(aa.length){
   const rate=+aa[0].sample_rate,samples=Math.round(+aa[0].duration*rate),audioDurationDelta=Math.abs(+aa[0].duration-+ba[0].duration);
   if(+ba[0].sample_rate!==rate||aa[0].channels!==ba[0].channels||audioDurationDelta>1/rate)throw Error('原声音轨采样率、声道或有效时长发生变化');
   originalAudio={input:audioHash(input,samples),output:audioHash(output,samples),codec:ba[0].codec_name,validSamples:samples,audioDurationDelta,paddingPolicy:'比较音轨声明时长内的有效采样；编码器在轨道结尾之外的填充不属于原声'};
   if(originalAudio.input!==originalAudio.output)throw Error('原声有效采样发生改变');
  }
 }else if(audio==='mute'&&ba.length)throw Error('静音任务仍有音轨');
 return{passed:true,frames:at.length,maxFrameDelta,durationDelta,dimensions:{width:v.width,height:v.height},originalAudio,audioPolicy:audio,visualReview:'待用户验收',iphone:'未验证'};
}
