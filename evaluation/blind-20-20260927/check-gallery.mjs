import assert from 'node:assert/strict';
import { readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, join, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startChrome } from '../../skill/plog-live/scripts/chrome-render.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const delivery = join(root, 'delivery/blind-20-20260927');
const manifest = JSON.parse(await readFile(join(here, 'manifest.lock.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(await readFile(join(here, 'protocol.md'))), manifest.protocolSha256);
const integrity = [];
for (const sample of manifest.samples) {
  const source = resolve(here, sample.local_file);
  const copy = join(delivery, 'cases', sample.id, 'scene', `photo${extname(source).toLowerCase()}`);
  const sourceSha256 = hash(await readFile(source));
  const scenePhotoSha256 = hash(await readFile(copy));
  assert.equal(sourceSha256, sample.sha256, `${sample.id} 原图变化`);
  assert.equal(scenePhotoSha256, sourceSha256, `${sample.id} 副本变化`);
  integrity.push({ id: sample.id, sourceSha256, scenePhotoSha256, identical: true });
}
await writeFile(join(here, 'input-integrity.json'), JSON.stringify(integrity, null, 2) + '\n');
const browser = await startChrome();
const checks = [];
try {
  const wait = async expression => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await browser.evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`离线页未就绪：${expression}`);
  };
  await browser.command('Page.navigate', { url: pathToFileURL(join(delivery, 'index.html')).href });
  await wait('document.querySelectorAll("#numbers button").length === 20');
  for (let i = 0; i < 20; i++) {
    await browser.evaluate(`document.querySelectorAll('#numbers button')[${i}].click()`);
    await wait(`(() => { const img = document.querySelector('#original img'); const frame = document.querySelector('iframe'); return img?.complete && img.naturalWidth > 0 && frame?.contentWindow?.PlogScene?.status === 'ready'; })()`);
    const before = await browser.evaluate(`({ id: document.getElementById('sample-id').textContent, hidden: document.getElementById('results').hidden, frames: document.querySelectorAll('iframe').length, previousDisabled: document.getElementById('previous').disabled, nextDisabled: document.getElementById('next').disabled })`);
    assert.equal(before.id, manifest.samples[i].id);
    assert.equal(before.hidden, true);
    assert.equal(before.frames, 1);
    assert.equal(before.previousDisabled, i === 0);
    assert.equal(before.nextDisabled, i === 19);
    const after = await browser.evaluate(`(() => { document.getElementById('reveal').click(); return { hidden: document.getElementById('results').hidden, expanded: document.getElementById('reveal').getAttribute('aria-expanded'), scoreCards: document.querySelectorAll('#scores > div').length, scoreTitle: document.getElementById('visual-state').textContent, sourceLinks: document.querySelectorAll('#source-links a').length, files: Array.from(document.querySelectorAll('#files a')).map(a => a.href) }; })()`);
    assert.equal(after.hidden, false);
    assert.equal(after.expanded, 'true');
    assert.equal(after.scoreCards, 4);
    assert.equal(after.sourceLinks, 2);
    assert.equal(after.files.length, 5);
    for (const href of after.files) await access(fileURLToPath(href));
    checks.push({ id: before.id, originalLoaded: true, sceneReady: true, oneIframe: true, revealAndReset: true, fourScores: true, outputLinksExist: true });
  }
  // Both navigation buttons and direct anonymous links must select the right case.
  assert.equal(await browser.evaluate(`(() => { document.getElementById('previous').click(); return document.getElementById('sample-id').textContent; })()`), 'B19');
  assert.equal(await browser.evaluate(`(() => { document.getElementById('next').click(); return document.getElementById('sample-id').textContent; })()`), 'B20');
  await browser.command('Page.navigate', { url: pathToFileURL(join(delivery, 'index.html')).href + '#B14' });
  await wait(`document.getElementById('sample-id')?.textContent === 'B14'`);
  const layout = [];
  for (const width of [1280, 390]) {
    await browser.command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    const state = await browser.evaluate(`({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, hidden: document.getElementById('results').hidden })`);
    assert.ok(state.scrollWidth <= state.width, `页面横向溢出 ${width}`);
    assert.equal(state.hidden, true);
    layout.push({ width, noHorizontalOverflow: true });
  }
  const report = { checkedAt: new Date().toISOString(), passed: true, mode: 'file:// 后台浏览器功能检查，无截图', originalIntegrity: integrity.length, cases: checks, layout, navigation: true, directLink: true, limits: ['渲染模式下检查文件加载、切换、揭晓及页面宽度；不等于用户浏览器或手机验收。', '没有重评视觉分数，没有重新渲染作品。'] };
  await writeFile(join(here, 'gallery-check.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ gallery: 'passed', cases: checks.length, originalIntegrity: integrity.length, layout }, null, 2));
} finally { await browser.close(); }
