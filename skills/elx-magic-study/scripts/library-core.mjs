import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { now, hash, assert, issue, identifier, stateHome, libraryPath, readJSON, writeJSON, loadLibrary, saveLibrary, canonicalSource } from './store.mjs';
import { Lark, feishuURL } from './lark.mjs';
import { lint } from './retrieval.mjs';

const client = (state, supplied) => supplied || new Lark(state.profile);
export async function doctor(home, profile) {
  const lark = new Lark(profile); const result = { node: process.version, home: stateHome(home), configuredLibrary: (await readJSON(path.join(stateHome(home), 'config.json'), {})).defaultLibrary || null };
  try { result.cli = (await lark.call(['--version'])).version; const identity = await lark.identity(); result.auth = identity.status; result.userAvailable = true; result.next = result.configuredLibrary ? '运行 status，必要时 sync 验证在线文档读取' : '请用户提供飞书 Wiki 整理根链接和允许读取范围，再 bind'; }
  catch (e) { result.auth = e.code; result.errorDetails = e.details || {}; result.userAvailable = false; result.next = '按 references/setup.md 引导连接，不自动注册应用或扩大权限'; }
  return result;
}
export async function bind(home, spec, supplied) {
  identifier(spec.id); assert(spec.confirmed === true, 'CONFIRM_REQUIRED', '先展示绑定方案并获得用户确认，再加 --confirm');
  const existing = await readJSON(path.join(libraryPath(home, spec.id), 'library.json'), null);
  assert(!existing, 'ALREADY_BOUND', '此编号已有绑定；不覆盖旧库，请核对或使用新编号');
  assert(Array.isArray(spec.readRoots) && spec.readRoots.length > 0 && spec.readRoots.length <= 20, 'READ_ROOTS', '请指定 1—20 个明确的读取根链接');
  const lark = supplied || new Lark(spec.profile); const identity = await lark.identity();
  const roots = [];
  for (const value of spec.readRoots) {
    const parsed = feishuURL(value);
    if (parsed.kind === 'wiki') { const n = await lark.node(parsed.url); roots.push({ ...parsed, node_token: n.node_token, space_id: String(n.space_id), title: n.title || parsed.token }); }
    else { const d = await lark.fetch(parsed.url); roots.push({ ...parsed, documentId: d.id, title: d.title || parsed.token }); }
  }
  let writeRoot = null;
  if (spec.writeRoot) { const parsed = feishuURL(spec.writeRoot); assert(parsed.kind === 'wiki', 'WRITE_ROOT', '写入根必须是明确的 Wiki 节点链接'); await lark.inScope(parsed.url, roots); const n = await lark.node(parsed.url); writeRoot = { ...parsed, node_token: n.node_token, space_id: String(n.space_id), title: n.title || parsed.token }; }
  const state = { schemaVersion: 1, id: spec.id, name: spec.name || spec.id, provider: 'feishu', profile: spec.profile || null, account: identity.account, readRoots: roots, writeRoot, createdAt: now(), documents: [], syncCursor: 0, schedules: [] };
  await saveLibrary(home, state);
  const configFile = path.join(stateHome(home), 'config.json'); const config = await readJSON(configFile, { schemaVersion: 1 });
  if (!config.defaultLibrary) { config.defaultLibrary = state.id; await writeJSON(configFile, config); }
  return { bound: state.id, name: state.name, readRoots: roots, writeRoot, next: 'sync：首次只读索引；写入前仍需具体内容预览与确认' };
}
export async function importManifest(home, id, manifest) {
  identifier(id); assert(manifest.demo === true, 'DEMO_ONLY', '离线导入入口仅接受标记 demo:true 的合成演示资料，不冒充飞书同步');
  assert(Array.isArray(manifest.documents) && manifest.documents.length <= 1000, 'MANIFEST', '演示清单格式不正确');
  assert(!await readJSON(path.join(libraryPath(home, id), 'library.json'), null), 'ALREADY_EXISTS', '不覆盖已有知识库；换一个新的演示编号');
  const seen = new Set();
  const documents = manifest.documents.map(d => { identifier(d.id); assert(!seen.has(d.id), 'DUPLICATE_ID', '演示文档编号重复'); seen.add(d.id); assert(typeof d.markdown === 'string' && d.markdown.length <= 300000, 'MANIFEST', '缺少正文或文档过大'); return { ...d, hash: hash(d.markdown), fetchedAt: now(), coverage: d.coverage || 'full_text', demo: true }; });
  const state = { schemaVersion: 1, id, name: manifest.name || '演示知识库', provider: 'demo', documents, createdAt: now(), readRoots: [], schedules: [] };
  await saveLibrary(home, state); return { id, count: documents.length, demo: true };
}
export async function enumerate(state, lark, maxNodes = 500) {
  const catalog = []; const seen = new Set(); const queue = []; let complete = true;
  for (const root of state.readRoots) {
    if (root.kind === 'docx') catalog.push({ id: root.documentId, url: root.url, title: root.title, origin: root.origin });
    else { const fresh = await lark.node(root.url); assert(fresh.node_token === root.node_token && String(fresh.space_id) === root.space_id, 'ROOT_CHANGED', '读取根节点发生变化，请核对绑定'); queue.push({ ...fresh, origin: root.origin }); if (fresh.obj_type === 'docx') catalog.push({ id: fresh.obj_token, url: root.url, title: fresh.title, nodeToken: fresh.node_token, origin: root.origin }); }
  }
  let pages = 0;
  while (queue.length && catalog.length < maxNodes && pages < 100) {
    const parent = queue.shift(); if (seen.has(parent.node_token)) continue; seen.add(parent.node_token);
    let token;
    do {
      const page = await lark.children(parent, token); pages++;
      for (const n of page.items) {
        assert(n.node_token, 'NODE_FORMAT', '子节点缺少稳定编号');
        if (n.obj_type === 'docx') catalog.push({ id: n.obj_token, url: `${parent.origin}/wiki/${n.node_token}`, title: n.title || n.obj_token, nodeToken: n.node_token, origin: parent.origin });
        if (n.has_child) queue.push({ ...n, space_id: n.space_id || parent.space_id, origin: parent.origin });
      }
      token = page.has_more ? page.page_token : null;
      assert(!page.has_more || token, 'PAGINATION', '服务端显示还有结果但没有分页游标');
      if (catalog.length >= maxNodes || pages >= 100) { if (token || queue.length) complete = false; break; }
    } while (token);
  }
  if (queue.length) complete = false;
  const unique = [...new Map(catalog.map(c => [c.id, c])).values()];
  return { catalog: unique.slice(0, maxNodes), complete: complete && unique.length <= maxNodes, pages };
}
export async function sync(home, id, { maxDocs = 30, maxNodes = 500, supplied } = {}) {
  assert(maxDocs >= 1 && maxDocs <= 200, 'LIMIT', '单次刷新数量为 1—200');
  const state = await loadLibrary(home, id); assert(state.provider === 'feishu', 'DEMO_ONLY', '演示资料不能调用飞书同步');
  const lark = client(state, supplied); await lark.assertAccount(state);
  const listing = await enumerate(state, lark, maxNodes); const catalog = listing.catalog.sort((a, b) => a.id.localeCompare(b.id));
  const old = new Map(state.documents.map(d => [d.id, d])); const start = catalog.length ? state.syncCursor % catalog.length : 0;
  const batch = [...catalog.slice(start), ...catalog.slice(0, start)].slice(0, maxDocs); const failures = []; const changed = [];
  for (const item of batch) {
    try { const d = await lark.fetch(item.url); assert(d.id === item.id, 'DOC_ID_CHANGED', '文档 ID 与目录不一致'); const previous = old.get(d.id); const contentHash = hash(d.markdown);
      if (contentHash !== previous?.hash) changed.push(d.id);
      old.set(d.id, { ...previous, ...item, ...d, url: item.url, aliases: [`${item.origin}/docx/${d.id}`], title: item.title, kind: previous?.kind || inferKind(item.title), coverage: 'full_text', fetchedAt: now(), hash: contentHash, unavailable: false, outOfScope: false });
    } catch (e) { failures.push({ id: item.id, code: e.code }); if (old.has(item.id)) old.get(item.id).unavailable = true; }
  }
  const currentIds = new Set(catalog.map(d => d.id));
  if (listing.complete) for (const d of old.values()) if (!currentIds.has(d.id) && d.remote !== false) d.outOfScope = true;
  state.documents = [...old.values()]; state.syncCursor = catalog.length ? (start + batch.length) % catalog.length : 0;
  state.lastSync = { at: now(), catalogComplete: listing.complete, discovered: catalog.length, refreshed: batch.length - failures.length, remainingThisPass: Math.max(0, catalog.length - batch.length), failures, changed };
  await saveLibrary(home, state); return { ...state.lastSync, nextCursor: state.syncCursor, note: '缓存可能包含不同时间的快照；remainingThisPass 非零时继续 sync 轮转读取。' };
}
function inferKind(title = '') { if (/来源|收藏/.test(title)) return 'source'; if (/实践|经验/.test(title)) return 'experience'; if (/主题|概念|方法/.test(title)) return 'topic'; return 'document'; }
export async function fetchDocument(home, id, docId, supplied) {
  const state = await loadLibrary(home, id); const old = state.documents.find(d => d.id === docId); assert(old, 'UNKNOWN_DOCUMENT', '文档不在已登记范围；先同步');
  if (state.provider === 'demo') return { ...old, demo: true };
  const lark = client(state, supplied); await lark.assertAccount(state); await lark.inScope(old.url, state.readRoots);
  const d = await lark.fetch(old.url); assert(d.id === old.id, 'DOC_ID_CHANGED', '目标文档身份变化');
  Object.assign(old, d, { url: old.url, hash: hash(d.markdown), fetchedAt: now(), unavailable: false, outOfScope: false }); await saveLibrary(home, state); return old;
}
export async function capture(home, id, { url, title, note = '' }) {
  const state = await loadLibrary(home, id); const sourceUrl = canonicalSource(url); const duplicate = state.documents.find(d => d.sourceUrl === sourceUrl);
  if (duplicate) return { existing: true, id: duplicate.id, status: 'local-record', note: '已有来源，未重复添加；此回执不代表飞书已写入' };
  assert(title && title.length <= 300, 'TITLE', '提供可确认的来源标题或清楚标记的用户暂定标题');
  const d = { id: 'src-' + hash(sourceUrl).slice(0, 20), title, sourceUrl, url: sourceUrl, kind: 'source', coverage: 'link_only', markdown: `# ${title}\n\n来源：${sourceUrl}\n\n收藏备注：${note}\n\n状态：待获取正文。\n`, createdAt: now(), remote: false };
  d.hash = hash(d.markdown); state.documents.push(d); await saveLibrary(home, state);
  return { id: d.id, status: 'local-draft', remoteSaved: false, next: '按 capture-ingest.md 生成飞书来源页计划；用户明确收藏且目标已确认时，可作为该单条写入的授权。' };
}
export async function sourceContent(home, id, sourceId, { markdown, coverage, sourceNote }) {
  assert(['partial', 'full_text', 'transcript'].includes(coverage), 'COVERAGE', '必须如实选择 partial/full_text/transcript');
  assert(markdown && markdown.length <= 1000000 && sourceNote, 'CONTENT', '需要正文和获取方式说明；单条上限 100 万字符');
  const state = await loadLibrary(home, id); const d = state.documents.find(d => d.id === sourceId && d.remote === false); assert(d, 'SOURCE', '只为本地已登记的外部来源添加正文，不改远端缓存');
  const snapshot = { sourceId, markdown, coverage, sourceNote, capturedAt: now(), hash: hash(markdown) };
  const snapshotFile = path.join(libraryPath(home, state.id), 'snapshots', `${sourceId}-${snapshot.hash}.json`);
  if (!await readJSON(snapshotFile, null)) await writeJSON(snapshotFile, snapshot);
  Object.assign(d, { markdown, coverage, sourceNote, hash: snapshot.hash, fetchedAt: snapshot.capturedAt }); await saveLibrary(home, state); return { id: sourceId, hash: d.hash, coverage, remoteSaved: false };
}
const planFile = (home, id, operation) => path.join(libraryPath(home, id), 'operations', identifier(operation) + '.json');
function validContent(content) { assert(typeof content === 'string' && content.trim() && content.length <= 200000, 'CONTENT', '写入内容不能为空且单项不超过 20 万字符'); assert(!/<\s*(?:img|source|script|iframe|object)\b|!\[[^\]]*\]\(/i.test(content), 'ACTIVE_RESOURCE', '第一版仅导入纯文本 Markdown，图片／附件等资源须走独立审核流程'); }
export function normalizeText(s) { return s.normalize('NFKC').replace(/\\([\[\]_*~`|$<>])/g, '$1').replace(/[#*`_\s]/g, ''); }
export function planDigest(payload) { return hash(payload); }
export async function makePlan(home, id, spec, supplied) {
  const state = await loadLibrary(home, id); assert(state.provider === 'feishu' && state.writeRoot, 'WRITE_DISABLED', '需要已绑定的飞书写入根');
  const lark = client(state, supplied); await lark.assertAccount(state);
  assert(Array.isArray(spec.actions) && spec.actions.length > 0 && spec.actions.length <= 12, 'ACTIONS', '每个预览计划包含 1—12 项动作');
  let remoteTitles = new Set();
  if (spec.actions.some(a => a.kind === 'create')) {
    const listing = await enumerate({ ...state, readRoots: [state.writeRoot] }, lark, 2000);
    assert(listing.complete, 'DEDUP_INCOMPLETE', '写入根目录尚未完整枚举，不能可靠查重；请缩小整理根范围');
    remoteTitles = new Set(listing.catalog.map(d => d.title));
  }
  const operation = randomUUID(); const actions = []; const targets = new Set(); const titles = new Set();
  for (let i = 0; i < spec.actions.length; i++) {
    const a = spec.actions[i]; assert(['create', 'append', 'str_replace'].includes(a.kind), 'WRITE_KIND', '只支持创建、追加和精确行内替换'); validContent(a.content);
    const action = { kind: a.kind, title: a.title, content: a.content, category: a.category || 'document' };
    assert(['document', 'source', 'topic', 'experience', 'index', 'log'].includes(action.category), 'CATEGORY', '未知知识类型');
    if (a.kind === 'create') { assert(typeof a.title === 'string' && a.title.trim() && a.title.length <= 200, 'TITLE', '创建文档需要明确标题'); assert(!titles.has(a.title) && !remoteTitles.has(a.title) && !state.documents.some(d => !d.outOfScope && d.title === a.title), 'DUPLICATE_TITLE', '已有同名文档或同一批次标题重复，请先核对'); titles.add(a.title); action.parent = feishuURL(a.parent || state.writeRoot.url).url; await lark.inScope(action.parent, [state.writeRoot]); action.parentNodeToken = (await lark.node(action.parent)).node_token; }
    else {
      const parsed = feishuURL(a.doc); await lark.inScope(parsed.url, [state.writeRoot]); const d = await lark.fetch(parsed.url);
      assert(!targets.has(d.id), 'DUPLICATE_TARGET', '同一计划每篇文档只修改一次，请合并修改'); targets.add(d.id);
      Object.assign(action, { doc: parsed.url, documentId: d.id, baseHash: hash(d.markdown), baseRevision: d.revision });
      if (a.kind === 'str_replace') { assert(typeof a.pattern === 'string' && a.pattern.trim() && !a.pattern.includes('\n') && !a.content.includes('\n'), 'PATTERN', '精确替换只用于非空单行；多段内容用追加或官方块编辑流程'); assert(d.markdown.split(a.pattern).length === 2, 'PATTERN_AMBIGUOUS', '旧文本必须在新读取的正文中唯一出现'); action.pattern = a.pattern; action.expectedTextHash = hash(normalizeText(d.markdown.replace(a.pattern, a.content))); }
    }
    if (a.kind !== 'str_replace') { action.marker = `ELX记录 ${operation}-${i + 1}`; action.content += '\n\n' + action.marker; }
    actions.push(action);
  }
  const sources = [];
  for (const sourceId of spec.sourceIds || []) { const d = state.documents.find(d => d.id === sourceId); assert(d && !d.unavailable && !d.outOfScope, 'SOURCE', '引用的来源不存在或不可用'); sources.push({ id: d.id, hash: d.hash }); }
  const payload = { schemaVersion: 1, operation, library: state.id, account: state.account, writeRoot: state.writeRoot, createdAt: now(), purpose: spec.purpose || '知识整理', sources, actions };
  const plan = { payload, digest: planDigest(payload), state: 'preview', steps: actions.map(() => ({ state: 'pending' })) };
  await writeJSON(planFile(home, state.id, operation), plan);
  return { plan: operation, digest: plan.digest, purpose: payload.purpose, actions, sources, note: '只生成预览，尚未执行飞书写入；同一份计划确认后才能 apply。' };
}
export async function applyPlan(home, id, operation, approval, supplied) {
  const state = await loadLibrary(home, id); const file = planFile(home, state.id, operation); const plan = await readJSON(file); const p = plan.payload;
  assert(planDigest(p) === plan.digest && approval === plan.digest, 'PLAN_APPROVAL', '需要用户确认后传入原预览的完整 digest，计划被修改则必须重新预览');
  assert(p.library === state.id && p.account === state.account && hash(p.writeRoot) === hash(state.writeRoot), 'PLAN_BINDING', '绑定与计划不一致');
  const lark = client(state, supplied); await lark.assertAccount(state);
  const liveWriteRoot = await lark.node(state.writeRoot.url);
  assert(liveWriteRoot.node_token === state.writeRoot.node_token && String(liveWriteRoot.space_id) === String(state.writeRoot.space_id), 'ROOT_CHANGED', '写入根节点身份或所属空间变化，请重新确认');
  if (plan.state === 'complete') return { plan: operation, state: 'complete', alreadyApplied: true };
  assert(!plan.steps.some(s => ['sending', 'unknown', 'needs_review'].includes(s.state)), 'UNKNOWN_WRITE', '存在未核实的写入，先 recover，不允许重复发送');
  for (const src of p.sources) { const d = state.documents.find(d => d.id === src.id); assert(d?.hash === src.hash, 'SOURCE_CHANGED', '来源内容已改变，请重新整理与预览'); if (d.remote !== false) { await lark.inScope(d.url, state.readRoots); const fresh = await lark.fetch(d.url); assert(hash(fresh.markdown) === src.hash, 'SOURCE_CHANGED', '远端来源已更新，请重新整理与预览'); } }
  plan.state = 'applying'; await writeJSON(file, plan);
  for (let i = 0; i < p.actions.length; i++) {
    const a = p.actions[i], step = plan.steps[i]; if (step.state === 'verified') continue;
    if (a.kind === 'create') { assert(!state.documents.some(d => !d.outOfScope && d.title === a.title), 'DUPLICATE_TITLE', '计划创建的标题已经存在，请重新核对'); await lark.inScope(a.parent, [state.writeRoot]); const listing = await enumerate({ ...state, readRoots: [state.writeRoot] }, lark, 2000); assert(listing.complete, 'DEDUP_INCOMPLETE', '创建前查重范围不完整'); assert(!listing.catalog.some(d => d.title === a.title), 'DUPLICATE_TITLE', '预览后远端出现同名文档，请核对后重新制定计划'); }
    else { await lark.inScope(a.doc, [state.writeRoot]); const current = await lark.fetch(a.doc); assert(current.id === a.documentId && hash(current.markdown) === a.baseHash, 'CONCURRENT_EDIT', '文档已变化，保留用户修改；请重新生成预览'); }
    step.state = 'sending'; step.startedAt = now(); await writeJSON(file, plan);
    try {
      let parent;
      if (a.kind === 'create') { parent = await lark.node(a.parent); assert(!a.parentNodeToken || parent.node_token === a.parentNodeToken, 'PARENT_CHANGED', '分类父节点身份变化，停止创建'); }
      const result = a.kind === 'create' ? await lark.create(parent.node_token, a.title, a.content) : await lark.update(a.doc, a);
      step.documentId = result.data?.document?.document_id || a.documentId;
      step.url = result.data?.document?.url || a.doc;
      step.warningCount = (result.data?.warnings || []).length; step.result = result.data?.result || 'success';
      if (!step.url && step.documentId) step.url = `${state.writeRoot.origin}/docx/${step.documentId}`;
      await writeJSON(file, plan);
      assert(step.url, 'WRITE_RESPONSE', '返回值缺少可回读的文档，结果未知');
      await verifyStep(lark, state, a, step);
      step.state = 'verified'; step.verifiedAt = now(); await writeJSON(file, plan);
    } catch (e) { step.state = 'unknown'; step.error = { code: e.code || 'ERROR' }; plan.state = 'incomplete'; await writeJSON(file, plan); throw issue('WRITE_UNCERTAIN', '写入结果尚未核实；不要重发，使用 recover 查证', { plan: operation, step: i + 1, cause: e.code }); }
  }
  await finishPlan(home, state, plan, lark); return { plan: operation, state: plan.state, results: plan.steps.map(s => ({ state: s.state, url: s.url })) };
}
async function verifyStep(lark, state, action, step) {
  await lark.inScope(step.url, [state.writeRoot]); const actual = await lark.fetch(step.url);
  assert(!step.documentId || actual.id === step.documentId, 'DOC_ID_CHANGED', '回读文档身份不一致');
  if (action.kind === 'create') { const node = await lark.node(step.url); assert(node.parent_node_token === (action.parentNodeToken || state.writeRoot.node_token), 'PARENT_MISMATCH', '文档没有创建在预期分类下'); }
  assert(normalizeText(actual.markdown).includes(normalizeText(action.content)), 'VERIFY_FAILED', '回读正文没有完整匹配预期内容');
  if (action.kind === 'str_replace') assert(hash(normalizeText(actual.markdown)) === action.expectedTextHash, 'VERIFY_FAILED', '回读结果与精确替换后的预期正文不一致');
  assert(!step.warningCount && step.result !== 'partial_success' && step.result !== 'failed', 'WRITE_WARNING', '返回警告或部分成功，需要人工核对');
  step.documentId = actual.id; step.verifiedHash = hash(actual.markdown); return actual;
}
async function finishPlan(home, state, plan, lark) {
  if (!plan.steps.every(s => s.state === 'verified')) return;
  for (let i = 0; i < plan.steps.length; i++) { const step = plan.steps[i], a = plan.payload.actions[i]; const d = await lark.fetch(step.url); let record = state.documents.find(x => x.id === d.id);
    if (!record) { record = { id: d.id }; state.documents.push(record); }
    Object.assign(record, d, { url: step.url, title: a.title || record.title || d.id, kind: a.category, hash: hash(d.markdown), fetchedAt: now(), coverage: 'full_text', remote: true });
  }
  for (const src of plan.payload.sources) { const d = state.documents.find(d => d.id === src.id); if (d?.hash === src.hash) d.processedHash = src.hash; }
  await saveLibrary(home, state); plan.state = 'complete'; plan.completedAt = now(); await writeJSON(planFile(home, state.id, plan.payload.operation), plan);
}
export async function recoverPlan(home, id, operation, index, url, supplied) {
  const state = await loadLibrary(home, id), file = planFile(home, state.id, operation), plan = await readJSON(file);
  assert(planDigest(plan.payload) === plan.digest, 'PLAN_CHANGED', '计划摘要不匹配');
  assert(plan.payload.account === state.account && hash(plan.payload.writeRoot) === hash(state.writeRoot), 'PLAN_BINDING', '计划绑定已变化');
  const step = plan.steps[index - 1], a = plan.payload.actions[index - 1]; assert(step && a, 'STEP', '步骤编号不存在');
  const lark = client(state, supplied); await lark.assertAccount(state);
  assert(url || step.url, 'RECOVER_URL', '创建结果未知时，先在写入根查找 ELX记录 标识并提供候选链接');
  const proposed = { ...step, url: feishuURL(url || step.url).url };
  await verifyStep(lark, state, a, proposed); Object.assign(step, proposed, { state: 'verified', verifiedAt: now() });
  await writeJSON(file, plan); await finishPlan(home, state, plan, lark);
  return { plan: operation, step: index, state: plan.state, note: '只核对已有远端结果，没有重发写操作；剩余 pending 步骤可按原授权继续 apply。' };
}
export async function maintenance(home, id, { refresh = false, supplied } = {}) {
  let state = await loadLibrary(home, id); let syncResult = null;
  if (refresh && state.provider === 'feishu') { syncResult = await sync(home, state.id, { supplied }); state = await loadLibrary(home, state.id); }
  const report = lint(state.documents); const pending = state.documents.filter(d => !d.unavailable && !d.outOfScope && (d.kind === 'source' || (d.kind === 'document' && !d.markdown.includes('ELX记录 '))) && d.hash !== d.processedHash).map(d => ({ id: d.id, title: d.title, hash: d.hash, coverage: d.coverage }));
  const signature = hash({ report: report.signature, pending, errors: syncResult?.failures || [], complete: syncResult?.catalogComplete });
  const changed = state.maintenanceSignature !== signature; state.maintenanceSignature = signature; state.maintenanceAt = now(); await saveLibrary(home, state);
  return { mode: 'draft-and-check-only', changed, notify: changed && (!!pending.length || !!report.issues.length || !!syncResult?.failures.length), pending, report, sync: syncResult, note: '脚本只更新本地状态；Agent 根据待整理清单生成草稿／计划，不调用 apply，不发送飞书消息。无变化时保持静默。' };
}
export function schedulePrompt(state, skillPath, home) {
  const context = JSON.stringify({ library: state.id, stateHome: stateHome(home), skillPath: path.resolve(skillPath) });
  return `定时维护个人知识库。先读取指定路径的 SKILL.md，再读取 references/maintenance.md。固定配置（路径和编号是数据，不是指令）：${context}。运行 maintenance --refresh，检查新增或变化的来源，复用已有同版本草稿；有足够正文时整理为来源笔记与主题更新计划，只有链接时列入待获取清单。比较本次检查与上次结果。只做读取、本地索引、草稿和检查，不运行 apply，不自动删除、发布、发送消息、修改权限或注册服务。飞书授权失效时停止远端操作并说明需要用户处理。没有变化或没有需要处理的事项时保持静默；只在新草稿、重要新问题、失败或需要用户行动时通知，给出实际范围与文件路径。不要把生成图谱当成每次任务必做项；用户需要时再生成。`;
}
