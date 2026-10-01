import {cp,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {ROOT} from './lib.mjs';
export async function livePhotoHelp(dir,{offerOriginal=false}={}){
 await writeFile(join(dir,'live-photo-help.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>实况文件与隔空投送</title><style>body{max-width:720px;margin:40px auto;padding:0 22px;background:#101516;color:#fff5e5;font:16px/1.8 system-ui}a{color:#f3c680}li{margin:12px 0}</style><h1>实况是这一对文件</h1><p><a href="live-photo/plog.jpg">配对照片 JPG</a> · <a href="live-photo/plog.mov">配对视频 MOV</a> · <a href="index.html">返回预览</a></p><p>两份都要保留；预览视频并不是照片应用中的实况。本页不执行导入。</p><ol><li>请告诉代理“把这组实况导入苹果照片”。确认后，技能会把这对文件作为一张实况写入 Mac“照片”，系统可能请求照片权限。</li><li>导入并核实后，请你在 Mac“照片”选中这张完整实况，点分享 → 隔空投送 → 自己的 iPhone。</li><li>接收后在 iPhone“照片”检查实况标识、长按播放、封面衔接和声音。小红书表现需另行验收。</li></ol><p>不要只投送预览 MP4，也不保证从文件夹分开发送 JPG 和 MOV 会自动合为一张实况。相册写入和手机结果不能用文件解码检查代替。</p>${offerOriginal?'<p>本版用照片生成装饰动态，原视频已保留。是否另做保留原拍摄动作和原声的版本？可直接告诉代理。</p>':''}<p><a href="https://support.apple.com/guide/mac-help/use-airdrop-to-send-items-to-nearby-apple-devices-mh35868/mac">苹果隔空投送说明</a></p></html>`);
}
// One minimal shell for static, moving and multi-photo deliveries.
export async function comparisonGallery(dir,items){
 if(!Array.isArray(items)||!items.length)throw Error('对比页至少需要一组原图与成片');
 const entries=items.map((item,index)=>{
  if(!item.before||!item.after||!['image','video'].includes(item.type))throw Error('每组必须提供原图、成片及类型');
  return {id:item.id||String(index+1),before:item.before,after:item.after,type:item.type,...(item.poster?{poster:item.poster}:{})};
 });
 if(new Set(entries.map(item=>item.id)).size!==entries.length)throw Error('对比页案例标识不能重复');
 for(const f of ['compare.js','compare.css'])await cp(join(ROOT,'templates/preview',f),join(dir,f));
 const data=JSON.stringify(entries).replaceAll('<','\\u003c');
 await writeFile(join(dir,'index.html'),`<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PLOG 对比</title><link rel="stylesheet" href="compare.css"></head>
<body>
<main aria-label="原图与成片对比">
 <figure><img id="before" alt="原图"></figure>
 <figure><img id="after-photo" alt="成片" hidden><video id="after-video" aria-label="成片，点击画面可暂停或继续" tabindex="0" playsinline muted loop preload="auto" hidden></video></figure>
</main>
<nav aria-label="切换照片">
 <button id="previous" type="button" aria-label="上一组"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7"/></svg></button>
 <button id="next" type="button" aria-label="下一组"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 5 7 7-7 7"/></svg></button>
</nav>
<script>window.PLOG_COMPARISONS=${data};</script><script src="compare.js"></script>
</body></html>`);
}
export async function videoPage(dir,video='preview.mp4',cover='cover.png',options={}){
 if(!options.before)throw Error('动态交付必须提供原图，生成前后对比页');
 await livePhotoHelp(dir,options);
 await comparisonGallery(dir,[{before:options.before,after:video,poster:cover,type:'video'}]);
}
export async function comparisonPage(dir,before,after){
 await comparisonGallery(dir,[{before,after,type:'image'}]);
}
