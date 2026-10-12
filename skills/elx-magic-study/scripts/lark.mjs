import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
import { assert, issue, hash } from './store.mjs';
import { nativeTable, tableHash } from './records.mjs';

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
  return parseCLIResult(result, args);
}
export function parseCLIResult(result, args = []) {
  let output; try { output = JSON.parse(result.stdout || result.stderr || '{}'); } catch { output = null; }
  if (result.error || result.status !== 0 || output?.ok === false || output?.data?.result === 'failed') {
    const e = output?.error || {};
    const warnings = Array.isArray(output?.data?.warnings) ? output.data.warnings : [];
    const degradeCodes = [...new Set(warnings.flatMap(w => [...String(w).matchAll(/degrade_code=(\d+)/g)].map(m => Number(m[1]))))];
    const missingScopes = (Array.isArray(e.missing_scopes) ? e.missing_scopes : []).filter(s => typeof s === 'string' && /^[a-z0-9_.:-]{1,128}$/i.test(s));
    const safeType = value => typeof value === 'string' && /^[a-z0-9_.:-]{1,80}$/i.test(value) ? value : null;
    const remoteResult = ['success','partial_success','failed'].includes(output?.data?.result) ? output.data.result : undefined;
    const hint = warnings.some(w => /Invalid block range\b/i.test(String(w))) ? 'check_block_range' : missingScopes.length ? 'request_missing_scopes' : result.error?.code === 'EPERM' ? 'check_local_permissions' : 'inspect_result_before_retry';
    const messages = { check_block_range: '飞书拒绝当前块范围；请重新读取块ID，分段编辑', request_missing_scopes: '飞书调用缺少必要权限；先核对所列scope', check_local_permissions: '本地CLI执行权限受阻；先检查本地环境', inspect_result_before_retry: '飞书CLI调用失败；先查证实际结果，不盲目重发' };
    // Only classified metadata: no raw warning, message, body, URL or credential.
    throw issue(result.status === 10 ? 'CONFIRMATION_REQUIRED' : 'LARK_ERROR', messages[hint], {
      subtype: safeType(e.subtype) || safeType(e.type) || safeType(result.error?.code) || (remoteResult === 'failed' ? 'remote_failed' : 'unknown'), code: /^\d+$/.test(String(e.code || '')) ? Number(e.code) : undefined,
      missingScopes, exitCode: result.status, remoteResult, warningCount: warnings.length, degradeCodes, hint
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
  async spaces(pageToken) {
    const response = await this.call(['wiki', '+space-list', '--as', 'user', '--page-size', '50', ...(pageToken ? ['--page-token', pageToken] : [])]);
    const data = response.data;
    const items = data?.spaces || data?.items;
    assert(Array.isArray(items) && typeof data.has_more === 'boolean', 'SPACE_FORMAT', '无法确认空间列表及分页状态，未判断为空');
    return { ...data, items };
  }
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
    let url = d.url;
    if (!url && /^https:\/\//.test(value)) url = feishuURL(value).url;
    if (!url) url = await this.documentURL(d.document_id);
    return { id: d.document_id, revision: d.revision_id ?? null, markdown: d.content, url, referenceMap: d.reference_map || {}, warnings: response.data.warnings || [] };
  }
  async documentURL(token) {
    assert(typeof token === 'string' && /^[A-Za-z0-9]{1,100}$/.test(token), 'DOC_ID', '请使用实际返回的文档token，不猜测域名');
    const response = await this.call(['drive','metas','batch_query','--data','-','--as','user'], { input: JSON.stringify({ request_docs: [{ doc_token: token, doc_type: 'docx' }], with_url: true }) });
    const d = response.data; const matches = d?.metas?.filter(m => (m.doc_token === token || m.request_doc_info?.doc_token === token) && (!m.doc_token || m.doc_token === token) && (!m.request_doc_info?.doc_token || m.request_doc_info.doc_token === token) && m.doc_type === 'docx');
    assert(!d?.failed_list?.length && matches?.length === 1 && matches[0].url, 'DOC_URL', '文件元数据未返回唯一、可核对的链接，停止初始化；不要重复创建');
    const parsed = feishuURL(matches[0].url);
    if (parsed.kind === 'docx') assert(parsed.token === token, 'DOC_ID_CHANGED', '元数据链接指向其他文档，停止');
    else assert((await this.node(parsed.url)).obj_token === token, 'DOC_ID_CHANGED', '元数据Wiki链接与实际文档不符');
    return parsed.url;
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
  async recordAPI(method, route, params, data) {
    const r = await this.call(['api', method, route, '--params', JSON.stringify(params), '--as', 'user', ...(data ? ['--data', '-'] : [])], data ? { input: JSON.stringify(data) } : {});
    const envelope = r.data ?? r;
    assert((envelope.code === undefined || envelope.code === 0) && !envelope.warnings?.length && !['failed', 'partial_success'].includes(envelope.result), 'RECORD_API', '表格接口返回失败、警告或部分成功，先核对结果');
    return envelope.data ?? envelope;
  }
  async recordTables(url, tableId) {
    const document = await this.fetch(url), blocks = [], tokens = new Set(); let token;
    for (let page = 0; page < 30; page++) {
      const data = await this.recordAPI('GET', `/open-apis/docx/v1/documents/${document.id}/blocks`, { page_size: 500, document_revision_id: document.revision ?? -1, ...(token ? { page_token: token } : {}) });
      assert(Array.isArray(data.items) && typeof data.has_more === 'boolean', 'RECORD_TABLE', '文档块分页响应不完整'); blocks.push(...data.items);
      if (!data.has_more) return { document, tables: blocks.filter(b => b.block_type === 31 && (!tableId || b.block_id === tableId)).map(b => {
        try { return nativeTable(blocks, b.block_id); } catch (e) { if (tableId || !['RECORD_TABLE', 'RECORD_RICH_CELL'].includes(e.code)) throw e; return { id: b.block_id, unsupported: e.code, headers: [], rows: [] }; }
      }) };
      assert(data.page_token && !tokens.has(data.page_token), 'RECORD_INCOMPLETE', '文档块分页未推进，不据此新增条目'); token = data.page_token; tokens.add(token);
    }
    throw issue('RECORD_INCOMPLETE', '文档块超出预算，先缩小记录文档');
  }
  async recordAppend(url, action) {
    const before = await this.recordTables(url, action.tableId), table = before.tables.find(t => t.id === action.tableId);
    assert(table && tableHash(table) === action.tableHash && hash(before.document.markdown) === action.baseHash, 'CONCURRENT_EDIT', '表格在预览后变化，先保留用户编辑并重新读取');
    const route = `/open-apis/docx/v1/documents/${before.document.id}/blocks`;
    await this.recordAPI('PATCH', `${route}/${table.id}`, { document_revision_id: before.document.revision ?? -1, client_token: action.nativeTokens.insert }, { insert_table_row: { row_index: -1 } });
    await pause(350);
    const after = await this.recordTables(url, action.tableId), appended = after.tables.find(t => t.id === table.id), width = table.headers.length;
    assert(appended && appended.rows.length === table.rows.length + 1 && appended.rows.at(-1).every(v => !v) && tableHash({ ...appended, rows: appended.rows.slice(0, -1), cells: appended.cells.slice(0, -width) }) === tableHash(table), 'RECORD_INSERT_UNCERTAIN', '新增行或旧表格不符，保留未知状态，不重发插入');
    const updates = [], creates = [];
    for (let i = 0; i < width; i++) if (action.values[i]) {
      const index = appended.cells.length - width + i, elements = [{ text_run: { content: action.values[i] } }];
      if (appended.textIds[index]) updates.push({ block_id: appended.textIds[index], update_text_elements: { elements } });
      else creates.push({ cell: appended.cells[index], elements, index: i });
    }
    if (updates.length) { await this.recordAPI('PATCH', `${route}/batch_update`, { document_revision_id: after.document.revision ?? -1, client_token: action.nativeTokens.fill }, { requests: updates }); await pause(350); }
    for (const c of creates) {
      await this.recordAPI('POST', `${route}/${c.cell}/children`, { document_revision_id: -1, client_token: action.nativeTokens.cells[c.index] }, { index: 0, children: [{ block_type: 2, text: { elements: c.elements } }] });
      await pause(350);
    }
    return { data: { document: { document_id: before.document.id, url }, result: 'success', warnings: [] } };
  }
  async workbenchRows(base) {
    const rows=[];let offset=0;
    for(let page=0;page<50;page++) {
      const r=await this.call(['base','+record-list','--base-token',base.token,'--table-id',base.tableId,'--format','json','--limit','200','--offset',String(offset),'--as','user']);const d=r.data;
      assert(Array.isArray(d?.data)&&Array.isArray(d.fields)&&Array.isArray(d.record_id_list)&&d.data.length===d.record_id_list.length&&typeof d.has_more==='boolean','BASE_FORMAT','Base列表格式不完整，不判定为空');
      assert(['记录键','条目名称','状态','我的备注／调整意见'].every(f=>d.fields.includes(f)),'BASE_SCHEMA','工作台关键字段缺失，先核对，不创建重复记录');
      for(let i=0;i<d.data.length;i++){assert(Array.isArray(d.data[i])&&d.data[i].length===d.fields.length,'BASE_FORMAT','Base矩阵列数不符');rows.push({recordId:d.record_id_list[i],fields:Object.fromEntries(d.fields.map((f,j)=>{let value=d.data[i][j]??'';if(f==='最近更新'&&value){assert(!Number.isNaN(Date.parse(value)),'BASE_FORMAT','更新时间不可解析');value=new Date(value).toISOString();}if(['来源链接','结果文档'].includes(f)&&typeof value==='string'){const link=value.match(/^\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);if(link&&link[1]===link[2])value=link[2];}return [f,value];}))});}
      if(!d.has_more)return rows;
      assert(d.data.length>0,'BASE_PAGINATION','Base分页未推进');offset+=d.data.length;
    }
    throw issue('BASE_INCOMPLETE','Base读取超过预算，不据此创建记录');
  }
  async workbenchUpsert(base, recordId, fields) {
    if(recordId){await this.call(['base','+record-upsert','--base-token',base.token,'--table-id',base.tableId,'--json',JSON.stringify(fields),'--record-id',recordId,'--as','user']);return recordId;}
    const r=await this.call(['base','+record-batch-create','--base-token',base.token,'--table-id',base.tableId,'--json',JSON.stringify({create_records:[fields]}),'--as','user']);
    const id=r.data?.record_id_list?.[0];assert(id,'BASE_RESPONSE','记录响应缺少ID，先查证，不重建');return id;
  }
  async workbenchRegion(url, heading, end) {
    const r=await this.call(['docs','+fetch','--doc',url,'--doc-format','xml','--detail','with-ids','--as','user']);const xml=r.data?.document?.content;
    assert(typeof xml==='string','WORKBENCH_FORMAT','未取得管理页块结构');
    const blocks=[...xml.matchAll(/<(h[1-6]|p)\b([^>]*)>([\s\S]*?)<\/\1>/g)].map(m=>({tag:m[1],id:m[2].match(/\b(?:block-id|block_id|id)="([A-Za-z0-9]+)"/)?.[1],text:m[3].replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')}));
    const starts=blocks.filter(b=>b.tag==='h2'&&b.text===heading),ends=blocks.filter(b=>b.tag==='p'&&b.text===end);assert(starts.length===1&&ends.length===1&&starts[0].id&&ends[0].id,'WORKBENCH_REGION','自动更新区域缺失或不唯一，请核对');
    const document=await this.fetch(url),prefix='## '+heading;const a=document.markdown.indexOf(prefix),b=document.markdown.indexOf(end,a);
    assert(a>=0&&b>a&&document.markdown.indexOf(prefix,a+prefix.length)<0&&document.revision===r.data.document.revision_id,'WORKBENCH_REGION','区域顺序或版本不符，重新读取');
    return {document,text:document.markdown.slice(a,b+end.length),startId:starts[0].id,endId:ends[0].id};
  }
  async workbenchWrite(url, region, content) {
    const r=await this.call(['docs','+update','--doc',url,'--command','block_replace','--start-block-id',region.startId,'--end-block-id',region.endId,'--revision-id',String(region.document.revision),'--doc-format','markdown','--content','-','--as','user'],{input:content});
    assert(r.data?.result==='success'&&!r.data?.warnings?.length,'WORKBENCH_WARNING','管理页返回警告或部分成功，先核对');return r;
  }
}
