import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assert, issue, hash } from './store.mjs';

export function binary() {
  if (process.env.ELX_LARK_BIN) { assert(path.isAbsolute(process.env.ELX_LARK_BIN), 'CLI_PATH', 'ELX_LARK_BIN 必须是绝对路径'); return process.env.ELX_LARK_BIN; }
  if (process.platform === 'win32') {
    const guesses = [path.join(process.env.APPDATA || '', 'npm/node_modules/@larksuite/cli/bin/lark-cli.exe')];
    for (const dir of (process.env.PATH || '').split(path.delimiter)) guesses.push(path.join(dir, 'lark-cli.exe'));
    const found = guesses.find(p => fs.existsSync(p));
    assert(found, 'CLI_MISSING', '未找到原生 lark-cli.exe；请按官方安装指南安装，或配置 ELX_LARK_BIN');
    return found;
  }
  return 'lark-cli';
}
export function transport(args, { profile, input, timeout = 60000 } = {}) {
  const result = spawnSync(binary(), [...(profile ? ['--profile', profile] : []), ...args], {
    encoding: 'utf8', input, windowsHide: true, shell: false, timeout, maxBuffer: 24 * 1024 * 1024,
    env: { ...process.env, LARKSUITE_CLI_NO_UPDATE_NOTIFIER: '1', LARKSUITE_CLI_NO_SKILLS_NOTIFIER: '1' }
  });
  let output; try { output = JSON.parse(result.stdout || result.stderr || '{}'); } catch { output = null; }
  if (result.error || result.status !== 0 || output?.ok === false) {
    const e = output?.error || {};
    // No raw stdout/stderr: they may contain credentials or full private content.
    throw issue(result.status === 10 ? 'CONFIRMATION_REQUIRED' : 'LARK_ERROR', '飞书 CLI 调用失败；不要直接重试未知结果的写操作', {
      subtype: e.subtype || e.type || result.error?.code || 'unknown', code: e.code,
      missingScopes: e.missing_scopes || [], exitCode: result.status
    });
  }
  if (args.includes('--version')) return { version: (result.stdout || '').trim() };
  assert(output && typeof output === 'object', 'LARK_FORMAT', '飞书 CLI 未返回可识别 JSON');
  return output;
}
export function feishuURL(value) {
  let u; try { u = new URL(value); } catch { throw issue('FEISHU_URL', '请提供准确的飞书 Wiki 或 docx HTTPS 链接'); }
  assert(u.protocol === 'https:' && !u.username && !u.password && /(^|\.)(feishu\.cn|larksuite\.com|larkoffice\.com)$/.test(u.hostname), 'FEISHU_URL', '不是支持的飞书 HTTPS 链接');
  const m = u.pathname.match(/^\/(wiki|docx)\/([A-Za-z0-9]+)\/?$/);
  assert(m, 'FEISHU_URL', '第一版绑定支持 Wiki 节点链接和 docx 文档链接');
  return { url: `${u.origin}/${m[1]}/${m[2]}`, kind: m[1], token: m[2], origin: u.origin };
}
export class Lark {
  constructor(profile, runner = transport) { this.profile = profile; this.runner = runner; }
  call(args, options = {}) { return this.runner(args, { profile: this.profile, ...options }); }
  async identity() {
    const data = await this.call(['auth', 'status', '--json']);
    const user = data.identities?.user;
    assert(user?.available && user.openId && data.appId, 'AUTH_REQUIRED', '需要飞书用户授权；请按 setup.md 进行分步引导');
    return { account: hash(`${data.appId}/${user.openId}/${this.profile || 'default'}`), status: user.tokenStatus || user.status, available: true };
  }
  async assertAccount(binding) { const actual = await this.identity(); assert(actual.account === binding.account, 'ACCOUNT_CHANGED', '飞书账号或应用已变化，停止使用旧绑定；请重新确认连接'); return actual; }
  async node(value) {
    const response = await this.call(['wiki', '+node-get', '--node-token', value, '--as', 'user']);
    const n = response.data?.node || response.data || response.node || response;
    assert(n?.node_token && n.space_id, 'NODE_FORMAT', '无法解析 Wiki 节点，停止操作');
    return n;
  }
  async fetch(value) {
    const response = await this.call(['docs', '+fetch', '--doc', value, '--as', 'user', '--doc-format', 'markdown']);
    const d = response.data?.document;
    assert(d?.document_id && typeof d.content === 'string', 'DOC_FORMAT', '无法解析文档内容，未更新缓存');
    return { id: d.document_id, revision: d.revision_id ?? null, markdown: d.content, url: d.url, referenceMap: d.reference_map || {}, warnings: response.data.warnings || [] };
  }
  async children(root, pageToken) {
    const response = await this.call(['wiki', '+node-list', '--space-id', String(root.space_id), '--parent-node-token', root.node_token, '--page-size', '50', '--as', 'user', ...(pageToken ? ['--page-token', pageToken] : [])]);
    const d = response.data;
    const items = d?.nodes || d?.items;
    assert(Array.isArray(items), 'LIST_FORMAT', '无法解析节点列表，不把未知格式视为列表为空');
    return { ...d, items };
  }
  async inScope(value, roots) {
    const target = feishuURL(value);
    if (roots.some(r => r.url === target.url)) return { allowed: true, resolved: target };
    let current;
    try { current = await this.node(target.url); } catch (e) { throw issue('SCOPE_UNKNOWN', '无法确认文档是否仍属于授权范围；未继续读取', { cause: e.code }); }
    const resolved = current;
    const seen = new Set();
    for (let depth = 0; depth < 100 && current; depth++) {
      if (roots.some(r => r.kind === 'wiki' && r.node_token === current.node_token && String(r.space_id) === String(current.space_id))) return { allowed: true, resolved };
      if (!current.parent_node_token || seen.has(current.parent_node_token)) break;
      seen.add(current.parent_node_token);
      current = await this.node(`${target.origin}/wiki/${current.parent_node_token}`);
    }
    throw issue('OUT_OF_SCOPE', '目标不在已绑定的文档或 Wiki 子树内');
  }
  async create(parent, title, markdown) {
    return this.call(['docs', '+create', '--parent-token', parent, '--title', title, '--doc-format', 'markdown', '--content', '-', '--as', 'user'], { input: markdown });
  }
  async update(doc, action) {
    assert(['append', 'str_replace'].includes(action.kind), 'WRITE_KIND', '辅助脚本只支持追加或精确行内替换，不做覆盖和删除');
    return this.call(['docs', '+update', '--doc', doc, '--command', action.kind, '--doc-format', 'markdown', '--content', '-', '--as', 'user', ...(action.kind === 'str_replace' ? ['--pattern', action.pattern] : []), ...(action.baseRevision !== null && action.baseRevision !== undefined ? ['--revision-id', String(action.baseRevision)] : [])], { input: action.content });
  }
}
