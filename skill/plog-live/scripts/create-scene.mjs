#!/usr/bin/env node
import { readFile, writeFile, mkdir, cp, readdir, rm } from 'node:fs/promises';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseArgs, inputFile, reportError } from './cli.mjs';

const usage = '用法：node create-scene.mjs --photo /原图.png --out /新场景目录 [--config /配置.json]';
try {
  const args = parseArgs(process.argv.slice(2), ['photo', 'out', 'config']);
  if (args.help) { console.log(usage); process.exit(0); }
  if (!args.out) throw new Error(usage);
  const photo = await inputFile(args.photo, '--photo');
  const ext = extname(photo).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) throw new Error('首版接受 PNG、JPEG 或 WebP 原图；不自动转换或重绘其他格式。');
  const config = args.config ? JSON.parse(await readFile(await inputFile(args.config, '--config'), 'utf8')) : {};
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('配置必须是 JSON 对象。');
  if (config.effect && config.effect !== 'paper-rain') throw new Error('首版只实现 paper-rain（纸片雨帘），其他效果仍为设计配方。');
  // Read metadata only. Keep the original framing unless both dimensions were
  // explicitly chosen; no image conversion, retouching or replacement occurs.
  const dimensions = spawnSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'orientation', photo], { encoding: 'utf8' });
  const metadata = dimensions.stdout || '';
  let originalWidth = Number(metadata.match(/pixelWidth:\s*(\d+)/)?.[1]);
  let originalHeight = Number(metadata.match(/pixelHeight:\s*(\d+)/)?.[1]);
  const orientation = Number(metadata.match(/orientation:\s*(\d+)/)?.[1] || 1);
  if (dimensions.status !== 0 || !originalWidth || !originalHeight) throw new Error('无法读取照片尺寸。创建场景需要 macOS 自带的 sips 元信息读取工具。');
  if ([5, 6, 7, 8].includes(orientation)) [originalWidth, originalHeight] = [originalHeight, originalWidth];
  const even = value => Math.max(64, 2 * Math.round(value / 2));
  if (config.width && !config.height) config.height = even(config.width * originalHeight / originalWidth);
  else if (config.height && !config.width) config.width = even(config.height * originalWidth / originalHeight);
  else if (!config.width && !config.height) {
    const scale = Math.min(1, 1920 / Math.max(originalWidth, originalHeight));
    config.width = even(originalWidth * scale); config.height = even(originalHeight * scale);
  }
  const template = resolve(dirname(fileURLToPath(import.meta.url)), '../templates/scene');
  const out = resolve(args.out);
  await mkdir(dirname(out), { recursive: true });
  await mkdir(out); // Deliberately exclusive: never overwrite an existing scene.
  try {
    for (const entry of await readdir(template)) await cp(join(template, entry), join(out, entry), { recursive: true, errorOnExist: true, force: false });
    await cp(photo, join(out, `photo${ext}`), { errorOnExist: true, force: false });
    const configText = `\n// 由创建场景程序添加；原图原样复制，按需调整位置。\n(function () {\n  const overrides = ${JSON.stringify({ ...config, photo: `photo${ext}` }, null, 2)};\n  const original = window.PLOG_CONFIG;\n  window.PLOG_CONFIG = { ...original, ...overrides, cloud: { ...original.cloud, ...overrides.cloud }, curtain: { ...original.curtain, ...overrides.curtain }, photoPosition: { ...original.photoPosition, ...overrides.photoPosition } };\n})();\n`;
    await writeFile(join(out, 'scene-config.js'), (await readFile(join(out, 'scene-config.js'), 'utf8')) + configText);
    await writeFile(join(out, 'source.json'), JSON.stringify({ source: photo, originalWidth, originalHeight, orientation, sha256: createHash('sha256').update(await readFile(photo)).digest('hex'), copiedWithoutModification: true, createdAt: new Date().toISOString(), effect: 'paper-rain', configOverrides: config }, null, 2) + '\n');
  } catch (error) { await rm(out, { recursive: true, force: true }); throw error; }
  console.log(JSON.stringify({ scene: out, preview: join(out, 'index.html'), originalPreserved: true }, null, 2));
} catch (error) { reportError(error); }
