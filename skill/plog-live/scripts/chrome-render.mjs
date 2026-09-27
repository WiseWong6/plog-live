// An isolated, headless Chrome process. No server, user profile, npm package,
// screenshot API, or changes to the user's open browser are involved.
import { spawn } from 'node:child_process';
import { mkdtemp, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { constants } from 'node:fs';

async function browserPath(explicit) {
  const paths = explicit ? [explicit] : [process.env.PLOG_CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
  for (const path of paths) { try { await access(path, constants.X_OK); return path; } catch {} }
  throw new Error('找不到可用的 Chrome。用 --browser 指定已安装浏览器的可执行文件；本程序不会自动安装。');
}

export async function startChrome(explicit) {
  const executable = await browserPath(explicit);
  const profile = await mkdtemp(join(tmpdir(), 'plog-render-'));
  const child = spawn(executable, ['--headless=new', '--remote-debugging-pipe', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions',
    '--allow-file-access-from-files', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  let id = 0, buffer = Buffer.alloc(0), stderr = '', closed = false;
  const pending = new Map();
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-3000); });
  function rejectAll(error) { for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error); } pending.clear(); }
  child.on('error', error => rejectAll(error));
  child.on('exit', code => { closed = true; rejectAll(new Error(`后台渲染浏览器退出（${code}）：${stderr}`)); });
  child.stdio[4].on('data', chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    let end;
    while ((end = buffer.indexOf(0)) !== -1) {
      const raw = buffer.subarray(0, end).toString(); buffer = buffer.subarray(end + 1);
      if (!raw) continue;
      let message;
      try { message = JSON.parse(raw); } catch { rejectAll(new Error('浏览器返回了无效数据。')); continue; }
      const entry = pending.get(message.id);
      if (entry) { pending.delete(message.id); clearTimeout(entry.timer); message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result); }
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    if (closed) return reject(new Error('后台渲染浏览器已关闭。'));
    const requestId = ++id;
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`浏览器操作超时：${method}`)); }, 45000);
    pending.set(requestId, { resolve, reject, timer });
    child.stdio[3].write(JSON.stringify({ id: requestId, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0', error => {
      if (error) { clearTimeout(timer); pending.delete(requestId); reject(error); }
    });
  });
  let closing;
  const close = () => closing ||= (async () => {
    if (!closed) {
      try { await send('Browser.close'); } catch {}
      await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 2000))]);
      if (!closed) { child.kill('SIGTERM'); await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 1000))]); }
    }
    rejectAll(new Error('渲染已结束。'));
    await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  })();
  try {
    await send('Browser.getVersion');
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const command = (method, params) => send(method, params, sessionId);
    await command('Page.enable');
    await command('Runtime.enable');
    await command('Page.addScriptToEvaluateOnNewDocument', { source: 'window.PLOG_RENDER_MODE = true;' });
    const evaluate = async expression => {
      const reply = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description || reply.exceptionDetails.text);
      return reply.result.value;
    };
    return { command, evaluate, close, executable };
  } catch (error) { await close(); throw error; }
}
