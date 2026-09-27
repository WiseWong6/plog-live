import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';

const execute = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, '../..');
const delivery = join(project, 'delivery/blind-20-20260927');
const casesRoot = join(delivery, 'cases');
const skill = join(project, 'skill/plog-live');
const manifest = JSON.parse(await readFile(join(here, 'manifest.lock.json'), 'utf8'));
const hash = data => createHash('sha256').update(data).digest('hex');
const check = await execute('git', ['diff', manifest.codeCommit, '--', 'skill/plog-live'], {cwd: project});
if (check.stdout.trim()) throw new Error('被测技能与冻结版本不同；不继续本轮盲测。');
if (manifest.samples.length !== 20 || new Set(manifest.samples.map(s => s.sha256)).size !== 20) throw new Error('必须有20张互不重复的锁定照片。');
await mkdir(casesRoot, {recursive: true});
const results = [];
let cursor = 0;

async function runSample(sample) {
  const started = Date.now();
  const root = join(casesRoot, sample.id);
  const result = {id: sample.id, startedAt: new Date().toISOString(), stage: 'input', success: false};
  const logs = [];
  await mkdir(root); // One official attempt per anonymous sample.
  const run = async (bin, args) => {
    const r = await execute(bin, args, {cwd: project, timeout: 240000, maxBuffer: 2 * 1024 * 1024});
    logs.push(r.stdout, r.stderr);
  };
  try {
    const source = resolve(here, sample.local_file);
    if (hash(await readFile(source)) !== sample.sha256) throw new Error('源照片与冻结记录不一致。');
    result.stage = 'create';
    await run(process.execPath, [join(skill, 'scripts/create-scene.mjs'), '--photo', source, '--out', join(root, 'scene')]);
    const provenance = JSON.parse(await readFile(join(root, 'scene/source.json'), 'utf8'));
    if (provenance.sha256 !== sample.sha256 || !provenance.copiedWithoutModification) throw new Error('原照片保持检查失败。');
    result.sourcePreserved = true;
    result.stage = 'render';
    await run(process.execPath, [join(skill, 'scripts/render-scene.mjs'), '--scene', join(root, 'scene'), '--out', join(root, 'render')]);
    const rendered = JSON.parse(await readFile(join(root, 'render/render-report.json'), 'utf8'));
    result.render = {width: rendered.width, height: rendered.height, frames: rendered.frames, duration: rendered.duration, fps: rendered.fps, ...rendered.validation};
    result.stage = 'pack';
    await run(join(skill, 'scripts/live-photo.sh'), ['pack', '--photo', join(root, 'render/cover.png'), '--video', join(root, 'render/preview.mp4'), '--output', join(root, 'live-photo'), '--name', sample.id, '--key-time', '1.5']);
    const packed = JSON.parse(await readFile(join(root, 'live-photo', `${sample.id}.validation.json`), 'utf8'));
    result.apple = {filePair: packed.file_pair.status, systemDecode: packed.system_decode.status, fullResult: packed.system_decode.full_non_degraded_result, keyTime: packed.actual_key_time_seconds, photosLibrary: packed.photos_library.status, iphone: packed.iphone_playback.status};
    result.success = packed.success && result.apple.filePair === 'passed' && result.apple.systemDecode === 'passed';
    result.stage = 'complete';
  } catch (error) {
    result.error = error.message;
    if (error.stdout) logs.push(error.stdout);
    if (error.stderr) logs.push(error.stderr);
  }
  result.elapsedSeconds = Math.round((Date.now() - started) / 100) / 10;
  await writeFile(join(root, 'technical.json'), JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
  await writeFile(join(root, 'commands.log'), logs.filter(Boolean).join('\n'), {flag: 'wx'});
  results.push(result);
  await writeFile(join(here, 'technical-results.json'), JSON.stringify([...results].sort((a,b) => a.id.localeCompare(b.id)), null, 2) + '\n');
  console.log(`${sample.id} ${result.success ? '技术检查通过' : `失败:${result.stage}`} ${result.elapsedSeconds}s (${results.length}/20)`);
}

async function worker() { while(cursor < manifest.samples.length) { const sample = manifest.samples[cursor++]; await runSample(sample); } }
await Promise.all([worker(), worker()]);
console.log(JSON.stringify({total: results.length, passed: results.filter(x => x.success).length, failed: results.filter(x => !x.success).map(x => ({id:x.id, stage:x.stage, error:x.error}))}, null, 2));
