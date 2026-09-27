import { resolve } from 'node:path';
import { stat, realpath } from 'node:fs/promises';

export function parseArgs(argv, allowed) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--help') { args.help = true; continue; }
    if (!key.startsWith('--') || !allowed.includes(key.slice(2))) throw new Error(`未知参数：${key}`);
    if (Object.hasOwn(args, key.slice(2))) throw new Error(`重复参数：${key}`);
    if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`参数缺少值：${key}`);
    args[key.slice(2)] = argv[++i];
  }
  return args;
}

export async function inputFile(value, label) {
  if (!value) throw new Error(`缺少 ${label}`);
  const path = await realpath(resolve(value));
  if (!(await stat(path)).isFile()) throw new Error(`${label} 必须是文件：${path}`);
  return path;
}

export function reportError(error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
