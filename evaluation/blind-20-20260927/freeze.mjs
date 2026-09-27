import {readFile, writeFile, access} from 'node:fs/promises';
import {resolve, dirname, join, relative, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, '../..');
const digest = data => createHash('sha256').update(data).digest('hex');
const samples = [];
for (const group of ['sources-a', 'sources-b']) {
  const raw = JSON.parse(await readFile(join(here, group, 'manifest.json'), 'utf8'));
  const items = Array.isArray(raw) ? raw : raw.samples || raw.photos;
  if (!Array.isArray(items) || items.length !== 10) throw new Error(`${group} 必须有10张照片。`);
  for (const item of items) {
    let source;
    const input = item.local_file;
    for (const candidate of isAbsolute(input) ? [input] : [resolve(project, input), resolve(here, group, input), resolve(here, input)]) {
      try { await access(candidate); source = candidate; break; } catch {}
    }
    if (!source) throw new Error(`找不到照片：${input}`);
    const bytes = await readFile(source), sha256 = digest(bytes);
    if (item.sha256 && item.sha256 !== sha256) throw new Error(`${input} 与选样记录不一致。`);
    samples.push({...item, source_id: item.id, local_file: relative(here, source), sha256, bytes: bytes.length});
  }
}
if (new Set(samples.map(item => item.sha256)).size !== 20) throw new Error('样本中出现重复照片。');
samples.sort((a,b) => digest('20260927:' + a.sha256).localeCompare(digest('20260927:' + b.sha256)));
samples.forEach((sample, i) => { sample.id = `B${String(i + 1).padStart(2, '0')}`; });
const codeCommit = execFileSync('git', ['rev-parse', 'c83e51d'], {cwd: project, encoding:'utf8'}).trim();
const locked = {lockedAt: new Date().toISOString(), seed: '20260927', codeCommit, mode: '未做逐图调整的默认纸雨模板', protocolSha256: digest(await readFile(join(here, 'protocol.md'))), samples};
await writeFile(join(here, 'manifest.lock.json'), JSON.stringify(locked, null, 2) + '\n', {flag:'wx'});
console.log(JSON.stringify({locked: samples.length, unique: 20, sourceTypes: [...new Set(samples.map(x=>x.source_type))], authors: new Set(samples.map(x=>x.author)).size, originalBytes: samples.reduce((n,x)=>n+x.bytes,0)}, null, 2));
