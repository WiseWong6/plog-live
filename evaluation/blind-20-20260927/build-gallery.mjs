import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Build an offline review page without changing the frozen skill or any photo.
const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, '../..');
const output = join(project, 'delivery/blind-20-20260927');
const readJSON = async name => JSON.parse(await readFile(join(here, name), 'utf8'));
const [manifest, technical, visual] = await Promise.all([
  readJSON('manifest.lock.json'), readJSON('technical-results.json'), readJSON('visual-results.json'),
]);
if (!Array.isArray(manifest.samples) || manifest.samples.length !== 20) throw new Error('冻结清单必须包含二十张照片。');
if (!Array.isArray(technical) || !Array.isArray(visual)) throw new Error('技术结果和视觉结果必须是数组。');

function indexResults(rows, name) {
  const map = new Map();
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || map.has(row.id)) throw new Error(`${name}存在缺失或重复的编号。`);
    map.set(row.id, row);
  }
  return map;
}
const technicalById = indexResults(technical, '技术结果');
const visualById = indexResults(visual, '视觉结果');
const ids = new Set();
const urlFor = path => relative(output, path).split(sep).map(encodeURIComponent).join('/');
async function existingURL(path) {
  try { return (await stat(path)).isFile() ? urlFor(path) : null; }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
function publicURL(value) {
  if (typeof value !== 'string') return null;
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; }
  catch { return null; }
}
const samples = [];
for (const sample of manifest.samples) {
  if (!/^B(?:0[1-9]|1[0-9]|20)$/.test(sample.id) || ids.has(sample.id)) throw new Error('样本编号必须为互不重复的 B01–B20。');
  ids.add(sample.id);
  if (typeof sample.local_file !== 'string' || !sample.local_file) throw new Error(`${sample.id}缺少原照片路径。`);
  const source = resolve(here, sample.local_file);
  const withinProject = relative(project, source);
  if (withinProject === '..' || withinProject.startsWith(`..${sep}`) || resolve(project, withinProject) !== source) throw new Error(`${sample.id}原照片必须位于本项目内。`);
  const root = join(output, 'cases', sample.id);
  const [original, scene, video, jpg, mov, cover, report] = await Promise.all([
    existingURL(source), existingURL(join(root, 'scene/index.html')),
    existingURL(join(root, 'render/preview.mp4')),
    existingURL(join(root, 'live-photo', `${sample.id}.jpg`)),
    existingURL(join(root, 'live-photo', `${sample.id}.mov`)),
    existingURL(join(root, 'render/cover.png')), existingURL(join(root, 'technical.json')),
  ]);
  samples.push({
    id: sample.id, original, scene, video, jpg, mov, cover, report,
    source: { author: sample.author ?? '', category: sample.category ?? '', description: sample.description ?? '', type: sample.source_type ?? '', sha256: sample.sha256 ?? '', page: publicURL(sample.source_page), image: publicURL(sample.image_url) },
    technical: technicalById.get(sample.id) ?? null, visual: visualById.get(sample.id) ?? null,
  });
}
samples.sort((a, b) => a.id.localeCompare(b.id));
for (const [name, results] of [['技术结果', technicalById], ['视觉结果', visualById]]) {
  for (const id of results.keys()) if (!ids.has(id)) throw new Error(`${name}含冻结清单外的编号：${id}`);
}

function galleryApp() {
  'use strict';
  const data = window.PLOG_BLIND_GALLERY;
  const $ = id => document.getElementById(id);
  const text = (tag, value, className) => {
    const element = document.createElement(tag);
    element.textContent = value == null || value === '' ? '未记录' : String(value);
    if (className) element.className = className;
    return element;
  };
  const value = v => v == null ? '未记录' : String(v);
  const stageName = v => ({ input: '读取原照片', create: '创建动效', render: '导出视频', pack: '封装实况照片', complete: '已完成' }[v] ?? value(v));
  const stateName = v => {
    if (v === true || v === 'passed') return '通过';
    if (v === false || v === 'failed') return '未通过';
    if (v === 'not_imported') return '未导入';
    if (v === 'imported_live_photo') return '已导入并识别为实况照片';
    if (v === 'imported_unverified') return '已导入，识别结果待验证';
    if (['not_tested', 'not_run', 'not_attempted', 'unverified', 'pending'].includes(v)) return '未验证';
    if (v == null || v === '') return '未记录';
    return String(v);
  };
  function row(list, label, content) { list.append(text('dt', label), text('dd', content)); }
  function link(container, title, href, external = false, download = false) {
    if (!href) return;
    const a = text('a', title);
    a.href = href;
    if (external) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    if (download) a.download = '';
    container.append(a);
  }
  let active = 0;
  const numberButtons = data.samples.map((sample, index) => {
    const button = text('button', sample.id);
    button.type = 'button';
    button.setAttribute('aria-label', `查看第 ${index + 1} 张，${sample.id}`);
    button.addEventListener('click', () => show(index));
    $('numbers').append(button);
    return button;
  });

  function buildResults(sample) {
    const visual = sample.visual;
    const technical = sample.technical;
    const scores = $('scores');
    scores.replaceChildren();
    const scoreLabels = { subject: '主体保护', placement: '位置与尺度', material: '可读性与材质', relation: '场景关系' };
    for (const [key, label] of Object.entries(scoreLabels)) {
      const score = visual?.scores?.[key];
      const card = document.createElement('div');
      card.append(text('span', label), text('strong', typeof score === 'number' ? `${score} / 2` : '未评分'));
      scores.append(card);
    }
    $('visual-state').textContent = visual == null ? '尚无视觉评审' : `${typeof visual.total === 'number' ? `${visual.total} / 8 · ` : ''}${visual.accepted === true ? '构图可接受' : visual.accepted === false ? '构图未通过' : '结论未记录'}`;
    $('visual-reason').textContent = visual?.reason || '尚未记录视觉依据。';
    const checks = $('checks');
    checks.replaceChildren();
    row(checks, '技术流程', technical == null ? '尚无技术记录' : technical.success === true ? '通过' : technical.success === false ? '未通过' : '状态未记录');
    row(checks, '执行阶段', stageName(technical?.stage));
    row(checks, '原照片保持', stateName(technical?.sourcePreserved));
    const render = technical?.render;
    row(checks, '画面与视频', render ? `${value(render.width)} × ${value(render.height)}，${value(render.duration)} 秒，${value(render.frames)} 帧，${value(render.fps)} 帧/秒` : '未记录');
    row(checks, '首尾循环', stateName(render?.exactLoop));
    row(checks, '回拖一致', stateName(render?.deterministicSeek));
    row(checks, '动作存在', stateName(render?.motionPresent));
    row(checks, '无音轨', stateName(render?.silent));
    row(checks, '苹果文件配对', stateName(technical?.apple?.filePair));
    row(checks, '苹果系统解码', stateName(technical?.apple?.systemDecode));
    row(checks, '完整解码结果', stateName(technical?.apple?.fullResult));
    row(checks, '封面时刻', technical?.apple?.keyTime == null ? '未记录' : `${technical.apple.keyTime} 秒`);
    row(checks, '相册导入', stateName(technical?.apple?.photosLibrary));
    row(checks, 'iPhone 长按播放', stateName(technical?.apple?.iphone));
    $('error').hidden = !technical?.error;
    $('error').textContent = technical?.error ? `失败记录：${technical.error}` : '';

    const source = $('source');
    source.replaceChildren();
    row(source, '作者', sample.source.author);
    row(source, '来源类型', sample.source.type);
    row(source, '类别', sample.source.category);
    row(source, '照片说明', sample.source.description);
    const sourceLinks = $('source-links');
    sourceLinks.replaceChildren();
    link(sourceLinks, '查看原作者页面', sample.source.page, true);
    link(sourceLinks, '原照片地址', sample.source.image, true);
    if (!sourceLinks.childElementCount) sourceLinks.append(text('span', '未记录可打开的来源链接。'));
    $('checksum').textContent = `原照片 SHA-256：${sample.source.sha256 || '未记录'}`;
    const files = $('files');
    files.replaceChildren();
    link(files, '下载预览视频', sample.video, false, true);
    link(files, '下载实况 JPG', sample.jpg, false, true);
    link(files, '下载实况 MOV', sample.mov, false, true);
    link(files, '查看封面', sample.cover, true);
    link(files, '查看技术记录', sample.report, true);
    if (!files.childElementCount) files.append(text('span', '本样本尚无可用输出文件。'));
    $('file-note').textContent = sample.jpg && sample.mov ? '实况照片需要同时保留 JPG 与 MOV；下载文件不等于已经导入或完成手机验收。' : '只列出实际存在的文件；未生成的实况资源不会显示下载入口。';
  }

  function show(index) {
    active = Math.max(0, Math.min(data.samples.length - 1, index));
    const sample = data.samples[active];
    // Removing the old browsing context stops its animation before loading another.
    $('animation').replaceChildren();
    $('original').replaceChildren();
    $('sample-id').textContent = sample.id;
    $('counter').textContent = `${active + 1} / ${data.samples.length}`;
    $('previous').disabled = active === 0;
    $('next').disabled = active === data.samples.length - 1;
    numberButtons.forEach((button, i) => {
      button.classList.toggle('active', i === active);
      button.setAttribute('aria-pressed', String(i === active));
    });
    $('results').hidden = true;
    $('reveal').textContent = '揭晓结果';
    $('reveal').setAttribute('aria-expanded', 'false');
    if (sample.original) {
      const img = document.createElement('img');
      img.alt = `原照片 ${sample.id}`;
      img.src = sample.original;
      img.decoding = 'async';
      img.addEventListener('error', () => $('original').replaceChildren(text('p', '原照片无法读取。', 'missing')), { once: true });
      $('original').append(img);
    } else $('original').append(text('p', '原照片文件不存在。', 'missing'));
    if (sample.scene) {
      const iframe = document.createElement('iframe');
      iframe.title = `${sample.id} 动态照片与播放控件`;
      iframe.src = sample.scene;
      iframe.setAttribute('allow', 'autoplay');
      $('animation').append(iframe);
    } else $('animation').append(text('p', '此样本没有可用动效。揭晓结果可查看记录。', 'missing'));
    buildResults(sample);
    try { history.replaceState(null, '', `#${sample.id}`); } catch { /* file:// restrictions must not prevent review. */ }
  }
  $('previous').addEventListener('click', () => show(active - 1));
  $('next').addEventListener('click', () => show(active + 1));
  $('reveal').addEventListener('click', () => {
    const hidden = !$('results').hidden;
    $('results').hidden = hidden;
    $('reveal').textContent = hidden ? '揭晓结果' : '收起结果';
    $('reveal').setAttribute('aria-expanded', String(!hidden));
  });
  window.addEventListener('pagehide', () => $('animation').replaceChildren());
  window.addEventListener('pageshow', event => { if (event.persisted) show(active); });
  window.addEventListener('hashchange', () => {
    const index = data.samples.findIndex(sample => `#${sample.id}` === location.hash);
    if (index >= 0 && index !== active) show(index);
  });
  const requested = data.samples.findIndex(sample => `#${sample.id}` === location.hash);
  show(requested >= 0 ? requested : 0);
}

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="color-scheme" content="dark">
  <title>PLOG · 二十张盲测</title>
  <link rel="stylesheet" href="style.css">
  <script defer src="gallery-data.js"></script>
</head>
<body>
  <main>
    <header><div><h1>二十张照片盲测</h1><p>PLOG 与摄影日记。先看原图与默认动效，再揭晓来源和结果。切换照片会重新隐藏结果。</p></div><span class="counter" id="counter" aria-live="polite">0 / 20</span></header>
    <nav id="numbers" class="numbers" aria-label="选择匿名照片"></nav>
    <div class="toolbar"><button id="previous" type="button">上一张</button><strong id="sample-id" aria-live="polite"></strong><button id="next" type="button">下一张</button></div>
    <section class="comparison" aria-label="原照片与动效对照">
      <figure><figcaption>原照片</figcaption><div id="original" class="media original"></div></figure>
      <figure><figcaption>默认动效</figcaption><div id="animation" class="media animation"></div></figure>
    </section>
    <div class="reveal-bar"><button id="reveal" type="button" aria-expanded="false" aria-controls="results">揭晓结果</button><span>单盲 AI 构图评审；没有逐张调参。</span></div>
    <section id="results" class="results" hidden>
      <article><h2 id="visual-state">视觉评审</h2><div id="scores" class="scores"></div><p id="visual-reason" class="reason"></p><p class="note">每项 0–2 分；总分至少 6 分且主体保护为 2 分，才算构图可接受。封面构图评审不代表完整动态观感验收。</p></article>
      <article><h2>技术记录</h2><dl id="checks"></dl><p id="error" class="error" hidden></p></article>
      <article><h2>来源</h2><dl id="source"></dl><div id="source-links" class="links"></div><p id="checksum" class="checksum"></p></article>
      <article><h2>输出文件</h2><div id="files" class="links"></div><p id="file-note" class="note"></p></article>
    </section>
    <footer>页面只加载当前一张动效。来源、评分和界面文字不会进入视频。</footer>
  </main>
</body>
</html>
`;
const css = `:root{color-scheme:dark;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:#f3eee3;background:#111515;font-synthesis:none}*{box-sizing:border-box}body{margin:0}main{width:min(1320px,100%);margin:auto;padding:30px 24px calc(28px + env(safe-area-inset-bottom))}header{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px}h1{font-size:23px;font-weight:600;margin:0 0 9px}p{line-height:1.75;margin:8px 0}header p,.note,footer,.reveal-bar span{color:#a9b4ad;font-size:13px}.counter{font-variant-numeric:tabular-nums;white-space:nowrap;color:#d5cbb9}.numbers{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:7px}button,a{touch-action:manipulation}button{border:1px solid #ffffff21;background:#ffffff09;color:inherit;border-radius:8px;font:inherit;cursor:pointer;min-height:40px;padding:8px 12px}button:hover{background:#ffffff15}button:disabled{opacity:.3;cursor:default}.numbers button{padding:7px 4px;font-size:13px;font-variant-numeric:tabular-nums}.numbers button.active{background:#f3c680;color:#181c19;border-color:#f3c680}button:focus-visible,a:focus-visible{outline:2px solid #f3c680;outline-offset:3px}.toolbar{display:flex;gap:20px;align-items:center;justify-content:center;padding:18px 0 16px}.toolbar strong{font-size:17px;min-width:45px;text-align:center}.comparison{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;min-width:0;background:#111515;border:1px solid #ffffff18;border-radius:12px;overflow:hidden}figcaption{font-size:13px;color:#c9d0ca;background:#19201e;padding:11px 14px}.media{height:clamp(400px,71vh,850px);width:100%;position:relative}.original{display:flex;justify-content:center;align-items:center;padding:12px 14px 120px}.original img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain}.animation iframe{border:0;display:block;width:100%;height:100%}.missing{margin:0;position:absolute;left:20px;right:20px;top:45%;text-align:center;font-size:14px;color:#b6bdb5}.reveal-bar{display:flex;align-items:center;justify-content:center;gap:15px;flex-wrap:wrap;padding:22px 0}.reveal-bar button{border-color:#f3c68088;color:#f3c680;padding:10px 22px}.results{display:grid;grid-template-columns:1fr 1fr;gap:16px}.results[hidden],[hidden]{display:none!important}article{min-width:0;border:1px solid #ffffff1a;background:#19201d;border-radius:12px;padding:22px}h2{font-size:17px;line-height:1.5;margin:0 0 18px}.scores{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.scores div{padding:12px;background:#ffffff06;border-radius:8px;display:flex;flex-direction:column;gap:7px}.scores span{font-size:12px;color:#b6bfb5}.scores strong{font-size:18px;color:#f3c680}.reason{font-size:14px;margin-top:16px}dl{display:grid;grid-template-columns:125px minmax(0,1fr);gap:9px 16px;font-size:13px;line-height:1.65;margin:0}dt{color:#acb7ac}dd{margin:0;overflow-wrap:anywhere}.links{display:flex;flex-wrap:wrap;gap:10px 16px;line-height:1.8;font-size:13px;margin:15px 0}.links a{color:#f3c680;text-underline-offset:4px}.links span{color:#acb7ac}.checksum{font:11px/1.7 ui-monospace,SFMono-Regular,monospace;color:#839187;overflow-wrap:anywhere;margin-top:16px}.error{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;border-left:2px solid #e8a492;padding-left:12px;color:#f1bbac;margin-top:18px}footer{text-align:center;margin-top:18px} @media(min-width:1500px){.original{padding-bottom:120px}}@media(max-width:720px){main{padding:20px 14px calc(20px + env(safe-area-inset-bottom))}header{align-items:flex-start}h1{font-size:20px}header p{font-size:12px}.numbers{grid-template-columns:repeat(5,minmax(0,1fr))}.comparison,.results{grid-template-columns:1fr}.media{height:clamp(380px,78vh,720px)}.reveal-bar{gap:10px}.reveal-bar span{width:100%;text-align:center;font-size:12px}article{padding:18px}dl{grid-template-columns:110px minmax(0,1fr);gap:8px 12px}}@media(max-width:420px){.original{padding-left:8px;padding-right:8px}.media{height:clamp(350px,75vh,650px)}dl{grid-template-columns:92px minmax(0,1fr);font-size:12px}}
`;
const serialized = JSON.stringify({ samples }, null, 2).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
await mkdir(output, { recursive: true });
await Promise.all([
  writeFile(join(output, 'index.html'), html),
  writeFile(join(output, 'style.css'), css),
  writeFile(join(output, 'gallery-data.js'), `window.PLOG_BLIND_GALLERY = ${serialized};\n(${galleryApp.toString()})();\n`),
]);
console.log(JSON.stringify({ output: join(output, 'index.html'), count: samples.length, technicalRecords: technical.length, visualRecords: visual.length, missingOriginals: samples.filter(s => !s.original).map(s => s.id), missingScenes: samples.filter(s => !s.scene).map(s => s.id) }, null, 2));
