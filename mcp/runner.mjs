import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const worker = fileURLToPath(new URL('./worker.mjs', import.meta.url));
const MAX_REQUEST = 2 * 1024 * 1024;
const MAX_RESPONSE = 8 * 1024 * 1024;

export function runWorker(request, timeoutMs = 90000) {
  const input = JSON.stringify(request);
  if (Buffer.byteLength(input) > MAX_REQUEST) throw Object.assign(new Error('请求超过 2 MiB'), { code: 'LIMIT' });
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [worker], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let output = '', errors = '', settled = false;
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); if (error) reject(error); else resolve(value); };
    const timer = setTimeout(() => { child.kill(); finish(Object.assign(new Error('子进程超时；写入结果需先查证'), { code: request.action === 'apply' ? 'UNKNOWN_RESULT' : 'TIMEOUT' })); }, timeoutMs);
    child.on('error', error => finish(error));
    child.stdout.on('data', chunk => {
      output += chunk;
      if (Buffer.byteLength(output) > MAX_RESPONSE) { child.kill(); finish(Object.assign(new Error('响应超过限制'), { code: 'LIMIT' })); }
    });
    child.stderr.on('data', chunk => { if (errors.length < 2000) errors += chunk.toString().slice(0, 2000 - errors.length); });
    child.on('close', code => {
      if (settled) return;
      try {
        const result = JSON.parse(output);
        if (!result.ok) finish(Object.assign(new Error(result.message || '操作失败'), { code: result.code || 'ERROR' }));
        else finish(null, result.data);
      } catch { finish(Object.assign(new Error(`子进程退出 ${code}，结果未确认`), { code: request.action === 'apply' ? 'UNKNOWN_RESULT' : 'WORKER_FAILED' })); }
    });
    child.stdin.end(input);
  });
}
