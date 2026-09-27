#!/usr/bin/env node
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { parseArgs, inputFile, reportError } from './cli.mjs';
import { startChrome } from './chrome-render.mjs';

const usage = '用法：node render-scene.mjs --scene /场景目录 --out /新导出目录 [--browser /Chrome可执行文件]';
let browser, encoder, output, completed = false;
const hash = value => createHash('sha256').update(value).digest('hex');
const dataBuffer = url => { if (!url?.startsWith('data:image/png;base64,')) throw new Error('画布没有返回有效 PNG。'); return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'); };
const stop = () => { encoder?.kill('SIGTERM'); void browser?.close(); process.exitCode = 130; };
process.once('SIGINT', stop); process.once('SIGTERM', stop);
try {
  const args = parseArgs(process.argv.slice(2), ['scene', 'out', 'browser']);
  if (args.help) { console.log(usage); process.exit(0); }
  if (!args.scene || !args.out) throw new Error(usage);
  const entry = await inputFile(join(resolve(args.scene), 'index.html'), '--scene/index.html');
  for (const bin of ['ffmpeg', 'ffprobe']) {
    const result = spawnSync(bin, ['-version'], { stdio: 'ignore' });
    if (result.error || result.status !== 0) throw new Error(`需要已安装的 ${bin}；本程序不会自动安装。`);
  }
  await mkdir(dirname(resolve(args.out)), { recursive: true });
  await mkdir(resolve(args.out)); output = resolve(args.out);
  browser = await startChrome(args.browser);
  const nav = await browser.command('Page.navigate', { url: pathToFileURL(entry).href });
  if (nav.errorText) throw new Error(nav.errorText);
  await browser.evaluate(`new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (window.PlogScene) { Promise.resolve(window.PlogScene.ready).then(resolve, reject); return; }
      if (Date.now() - start > 15000) { reject(new Error('场景未能初始化')); return; }
      setTimeout(check, 25);
    }; check();
  })`);
  const config = await browser.evaluate(`({width:PlogScene.width,height:PlogScene.height,duration:PlogScene.duration,fps:PLOG_CONFIG.fps,keyTime:PLOG_CONFIG.keyTime,effect:PLOG_CONFIG.effect})`);
  const { width, height, duration, fps, keyTime } = config;
  if (![width, height, fps].every(Number.isInteger) || width < 16 || height < 16 || width > 4096 || height > 4096 || width % 2 || height % 2 || fps < 1 || fps > 60 || !Number.isFinite(duration) || duration <= 0 || duration > 15 || !Number.isFinite(keyTime) || keyTime < 0 || keyTime >= duration) throw new Error('导出参数无效：尺寸须为16–4096的偶数、帧率1–60、时长0–15秒、封面时刻须在片长内。');
  if (Math.abs(duration * fps - Math.round(duration * fps)) > 1e-7 || Math.abs(keyTime * fps - Math.round(keyTime * fps)) > 1e-7) throw new Error('时长和封面时刻必须对齐完整视频帧。');
  const count = Math.round(duration * fps);
  if (count < 2) throw new Error('实况照片动效至少需要两帧。');
  const capture = async time => dataBuffer(await browser.evaluate(`PlogScene.renderAt(${time}); PlogScene.canvas.toDataURL('image/png')`));
  const a = await capture(0), b = await capture(duration), key = await capture(keyTime), again = await capture(0);
  const loopExact = hash(a) === hash(b), seekStable = hash(a) === hash(again);
  // The cover can be the first frame. Check movement independently of that choice.
  let motionPresent = false;
  for (const sampleFrame of new Set([0.25, 0.5, 0.75].map(part => Math.min(count - 1, Math.max(1, Math.floor(count * part)))))) {
    if (hash(await capture(sampleFrame / fps)) !== hash(a)) { motionPresent = true; break; }
  }
  if (!loopExact || !seekStable || !motionPresent) throw new Error(`动作校验未通过：循环=${loopExact}，回拖一致=${seekStable}，存在运动=${motionPresent}`);
  await writeFile(join(output, 'cover.png'), key, { flag: 'wx' });
  let stderr = '';
  encoder = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-nostdin', '-n', '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'png', '-i', 'pipe:0', '-an', '-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', join(output, 'preview.mp4')], { stdio: ['pipe', 'ignore', 'pipe'] });
  encoder.stderr.on('data', data => { stderr = (stderr + data).slice(-4000); });
  // Attach immediately so a failed encoder never causes an unhandled EPIPE.
  let encoderError;
  encoder.stdin.on('error', error => { encoderError = error; });
  const encoded = new Promise((resolve, reject) => { encoder.once('error', reject); encoder.once('close', code => code === 0 ? resolve() : reject(new Error(`视频编码失败：${stderr || code}`))); });
  encoded.catch(() => {});
  for (let frame = 0; frame < count; frame++) {
    if (encoderError || process.exitCode === 130) throw encoderError || new Error('渲染已取消。');
    const bytes = await capture(frame / fps);
    if (!encoder.stdin.write(bytes)) await once(encoder.stdin, 'drain');
    if (frame % fps === 0) process.stderr.write(`已渲染 ${frame}/${count} 帧\n`);
  }
  encoder.stdin.end(); await encoded;
  const probe = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_name,codec_type,width,height,nb_read_frames:format=duration', '-of', 'json', join(output, 'preview.mp4')], { encoding: 'utf8' });
  if (probe.status !== 0) throw new Error(`导出视频无法读取：${probe.stderr}`);
  const media = JSON.parse(probe.stdout), video = media.streams.find(stream => stream.codec_type === 'video');
  if (!video || video.width !== width || video.height !== height || Number(video.nb_read_frames) !== count || Math.abs(Number(media.format.duration) - duration) > 1 / fps || media.streams.some(s => s.codec_type === 'audio')) throw new Error('编码结果的尺寸、帧数、时长或音轨不符合场景配置。');
  let source = null;
  try { source = JSON.parse(await readFile(join(dirname(entry), 'source.json'), 'utf8')); } catch {}
  const report = { createdAt: new Date().toISOString(), scene: dirname(entry), ...config, frames: count,
    validation: { exactLoop: loopExact, deterministicSeek: seekStable, motionPresent, encodedDimensions: true, encodedFrames: true, silent: true, browserInteractionReviewed: false, visualReview: '待用户验收', livePhotoPackaged: false },
    source, files: { cover: 'cover.png', preview: 'preview.mp4' }, browser: browser.executable,
    note: '通过时间采样和文件检查；未进行浏览器界面操作或截图观感验收。所有帧直接送入编码器，无逐帧临时图片。' };
  await writeFile(join(output, 'render-report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  completed = true;
  console.log(JSON.stringify({ output, cover: join(output, 'cover.png'), video: join(output, 'preview.mp4'), report: join(output, 'render-report.json') }, null, 2));
} catch (error) { reportError(error); }
finally {
  if (encoder && encoder.exitCode === null) encoder.kill('SIGTERM');
  await browser?.close();
  if (output && !completed) await rm(output, { recursive: true, force: true });
  process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
}
