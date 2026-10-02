import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { createHash, randomUUID } from 'node:crypto';

export const now = () => new Date().toISOString();
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const issue = (code, message, details = {}) => Object.assign(new Error(message), { code, details });
export const assert = (condition, code, message) => { if (!condition) throw issue(code, message); };
export const identifier = value => { assert(/^[a-zA-Z0-9_-]{1,100}$/.test(value || ''), 'INVALID_ID', '编号只能包含字母、数字、下划线或短横线'); return value; };
export const stateHome = value => path.resolve(value || process.env.ELX_MAGIC_STUDY_HOME || process.env.ELX_LIBRARY_HOME || path.join(os.homedir(), '.elx-library'));
export const libraryPath = (home, id) => path.join(stateHome(home), 'libraries', identifier(id));
export async function readJSON(file, fallback) {
  try { return JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, '')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return structuredClone(fallback); throw error; }
}
export async function writeJSON(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const pending = file + '.' + randomUUID() + '.tmp';
  await fs.writeFile(pending, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await fs.rename(pending, file);
}
export async function writeNew(file, text) {
  await fs.mkdir(path.dirname(path.resolve(file)), { recursive: true });
  await fs.writeFile(file, text, { flag: 'wx', mode: 0o600 });
  return path.resolve(file);
}
// OS-held loopback listener is a process lock, not a service. It closes on exit;
// no lock files or user data need deletion. A port collision fails closed.
export async function locked(home, fn) {
  const key = stateHome(home).toLowerCase();
  const port = 32000 + (parseInt(hash(key).slice(0, 8), 16) % 20000);
  const server = net.createServer(socket => socket.destroy());
  await new Promise((resolve, reject) => { server.once('error', () => reject(issue('BUSY', '另一个本地任务正在使用此状态目录，请稍后重试'))); server.listen(port, '127.0.0.1', resolve); });
  try { return await fn(); } finally { await new Promise(resolve => server.close(resolve)); }
}
export async function loadLibrary(home, id) {
  if (!id) id = (await readJSON(path.join(stateHome(home), 'config.json'), {})).defaultLibrary;
  assert(id, 'ONBOARDING_REQUIRED', '尚未绑定知识库；先运行 doctor，再按 setup.md 引导连接');
  const state = await readJSON(path.join(libraryPath(home, id), 'library.json'));
  assert(state.schemaVersion === 1 && state.id === id && Array.isArray(state.documents), 'STATE_SCHEMA', '状态文件版本或结构不匹配');
  return state;
}
export const saveLibrary = (home, state) => writeJSON(path.join(libraryPath(home, state.id), 'library.json'), state);
export function canonicalSource(value) {
  let url; try { url = new URL(value); } catch { throw issue('SOURCE_URL', '来源需要完整的 HTTP(S) URL'); }
  assert(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password, 'SOURCE_URL', '来源仅允许不带账号密码的 HTTP(S) URL');
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|spm_id_from$|spm$)/i.test(key)) url.searchParams.delete(key);
  // Keep fragments and meaningful query parameters (video parts/time anchors).
  return url.href;
}
export function safeLink(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function links(markdown) {
  const found = new Set();
  for (const m of markdown.matchAll(/https?:\/\/[^\s<>"')\]]+/g)) { const u = safeLink(m[0]); if (u) found.add(u); }
  return [...found];
}
