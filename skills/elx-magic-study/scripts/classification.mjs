import path from 'node:path';
import { assert, hash, loadLibrary, libraryPath } from './store.mjs';
import { Lark, feishuURL } from './lark.mjs';
import { search } from './retrieval.mjs';

const active = d => !d.unavailable && !d.outOfScope;
const contentAvailable = d => ['full_text', 'partial', 'transcript'].includes(d.coverage) && !!d.markdown?.trim();
const key = s => s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const text = (s, max, code) => { assert(typeof s === 'string' && s.trim() && s.length <= max && !/[\r\n\x00-\x1f]/.test(s), code, `需要 1—${max} 字符的单行说明`); return s.trim(); };
const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\\`*_[\]|]/g, '\\$&');
function requireNewSource(state, sourceId) {
  assert(!state.documents.some(d => active(d) && d.kind === 'source' && d.recordRole === 'derived' && (d.classification?.sourceId === sourceId || d.inputVersions?.some(s => s.id === sourceId))), 'SOURCE_ALREADY_FILED', '该来源已有笔记，请复用并单独预览补充；不通过再次分类创建副本或搬家');
}
function sourceRecord(state, id) {
  const d = state.documents.find(d => d.id === id && active(d));
  assert(d && (d.recordRole === 'input' || (d.recordRole === undefined && d.remote === false)), 'CLASSIFICATION_SOURCE', '分类只用于已登记的新输入；旧角色不明的记录需先确认角色');
  return d;
}
export async function classificationPath(state, lark, value) {
  const root = state.writeRoot, parsed = feishuURL(value);
  assert(parsed.kind === 'wiki' && parsed.origin === root.origin, 'CLASSIFICATION_PARENT', '分类位置必须是当前写入根下的真实 Wiki 节点');
  await lark.inScope(parsed.url, [root]);
  const path = []; let node = await lark.node(parsed.url);
  while (node.node_token !== root.node_token) {
    assert(String(node.space_id) === String(root.space_id), 'OUT_OF_SCOPE', '分类位置已离开原空间');
    assert(path.length < 2, 'CLASSIFICATION_DEPTH', '分类最多两层：大书架／主题分类；不在更深目录自动入库');
    path.unshift({ nodeToken: node.node_token, title: node.title || node.node_token, url: `${root.origin}/wiki/${node.node_token}` });
    assert(node.parent_node_token, 'OUT_OF_SCOPE', '分类不在写入根下');
    node = await lark.node(`${root.origin}/wiki/${node.parent_node_token}`);
  }
  assert(String(node.space_id) === String(root.space_id), 'ROOT_CHANGED', '分类读取根空间改变');
  assert(path.length, 'CLASSIFICATION_PARENT', '请选大书架或其主题分类，不把新资料直接放到首页');
  return { url: parsed.url, path };
}

async function locations(state, lark, limit) {
  const root = state.writeRoot, fresh = await lark.node(root.url);
  assert(fresh.node_token === root.node_token && String(fresh.space_id) === String(root.space_id), 'ROOT_CHANGED', '写入根身份改变');
  const queue = [{ node: fresh, path: [], url: root.url }], items = [], seen = new Set([fresh.node_token]); let pages = 0;
  while (queue.length) {
    const parent = queue.shift(); await lark.inScope(parent.url, [root]);
    let token; const tokens = new Set();
    do {
      if (pages >= 100 || items.length >= limit) return { items, complete: false, depth: 2 };
      const page = await lark.children(parent.node, token); pages++;
      assert(Array.isArray(page.items), 'LIST_FORMAT', '目录列表格式不正确');
      for (let i = 0; i < page.items.length; i++) {
        if (items.length >= limit) return { items, complete: false, depth: 2 };
        const n = page.items[i]; assert(n.node_token, 'NODE_FORMAT', '目录节点缺少编号');
        if (seen.has(n.node_token)) continue; seen.add(n.node_token);
        const entry = { nodeToken: n.node_token, title: n.title || n.node_token, url: `${root.origin}/wiki/${n.node_token}` };
        const trail = [...parent.path, entry]; items.push({ ...entry, path: trail, objectType: n.obj_type });
        if (trail.length < 2 && n.has_child) queue.push({ node: { ...n, space_id: n.space_id || root.space_id }, path: trail, url: entry.url });
      }
      token = page.has_more ? page.page_token : null;
      assert(!page.has_more || (token && !tokens.has(token)), 'PAGINATION', '目录分页游标缺失或重复，不能据此判断没有合适分类');
      if (token) tokens.add(token);
    } while (token);
  }
  return { items, complete: true, depth: 2 };
}

export async function classificationContext(home, id, sourceId, { queries = [], limit = 300, supplied } = {}) {
  const state = await loadLibrary(home, id);
  assert(state.provider === 'feishu' && state.writeRoot, 'WRITE_DISABLED', '需要已绑定的飞书写入根');
  assert(Number.isInteger(limit) && limit >= 1 && limit <= 1000, 'LIMIT', '目录数量需为 1—1000');
  const lark = supplied || new Lark(state.profile); await lark.assertAccount(state);
  const d = sourceRecord(state, sourceId);
  if (d.remote !== false) await lark.inScope(d.url, state.readRoots);
  const catalog = await locations(state, lark, limit);
  const available = state.documents.filter(active);
  // Query terms come from the Agent's reading. Link-only titles are not evidence.
  const topicCandidates = search(available.filter(t => t.kind === 'topic' && t.id !== d.id), contentAvailable(d) ? queries : [], { limit: 8, expand: false });
  for (const candidate of topicCandidates.results) await lark.inScope(candidate.url, state.readRoots);
  return { mode: 'read-only', source: { id: d.id, title: d.title, url: d.url, hash: d.hash, coverage: d.coverage, markdown: d.markdown.slice(0, 20000), truncated: d.markdown.length > 20000, cached: true, localStateFile: path.join(libraryPath(home, state.id), 'library.json') }, locations: catalog,
    existingTags: [...new Set(available.filter(d => d.classificationForHash === d.hash).flatMap(d => d.tags || []))].slice(0, 200), topicCandidates,
    next: 'Agent 读取正文后选一个主位置；目录项不一定是书架，需核对用途。优先复用；目录不完整不能认定分类不存在。主题候选仅为关键词结果，须 fetch 后提供原文依据。' };
}

export async function prepareClassification(state, lark, action, input, plannedDestination) {
  assert(action.kind === 'create' && action.category === 'source', 'CLASSIFICATION_ACTION', '本轮分类仅用于新建来源笔记；不搬迁或改写旧笔记');
  assert(input && ['classified', 'pending'].includes(input.status) && ['content', 'user', 'insufficient'].includes(input.basis), 'CLASSIFICATION', '分类状态或依据无效');
  const source = sourceRecord(state, input.sourceId);
  requireNewSource(state, source.id);
  assert(source.hash === input.sourceHash, 'SOURCE_CHANGED', '分类使用的来源版本已变化，重新读取和预览');
  if (source.remote !== false) { await lark.inScope(source.url, state.readRoots); const fresh = await lark.fetch(source.url); assert(fresh.id === source.id && hash(fresh.markdown) === source.hash, 'SOURCE_CHANGED', '远端来源已更新，先 fetch 后重新分类'); }
  const reason = text(input.reason, 500, 'CLASSIFICATION_REASON');
  const hasContent = contentAvailable(source);
  assert(hasContent || (input.status === 'pending' && input.basis !== 'content'), 'CLASSIFICATION_COVERAGE', '只有链接或覆盖未知时保留待整理，不凭标题进行内容分类');
  assert(input.basis !== 'insufficient' || input.status === 'pending', 'CLASSIFICATION', '依据不足必须保留待整理');
  const evidence = input.basis === 'content' ? text(input.evidence, 500, 'CLASSIFICATION_EVIDENCE') : '';
  assert(!evidence || source.markdown.includes(evidence), 'CLASSIFICATION_EVIDENCE', '分类依据必须出现在当前来源正文中');
  const rawTags = input.tags || []; assert(Array.isArray(rawTags) && rawTags.length <= 20, 'TAGS', '标签应为少量字符串');
  const existing = new Map(state.documents.filter(d => active(d) && d.classificationForHash === d.hash).flatMap(d => (d.tags || []).map(t => [key(t), t])));
  const tags = [];
  for (const raw of rawTags) {
    assert(typeof raw === 'string', 'TAGS', '标签必须为文字'); const value = raw.normalize('NFKC').trim().replace(/\s+/g, ' '); if (!value) continue;
    assert(value.length <= 32 && /^[\p{L}\p{N} .+#-]+$/u.test(value), 'TAGS', '标签为 1—32 字符的词语，不包含链接或控制符');
    if (!tags.some(t => key(t) === key(value))) tags.push(existing.get(key(value)) || value);
  }
  assert(tags.length <= 5, 'TAGS', '每份资料最多 5 个标签');
  const related = input.relatedTopics || []; assert(Array.isArray(related) && related.length <= 3, 'TOPIC', '最多关联 3 个已存在主题');
  assert(hasContent || (!tags.length && !related.length), 'CLASSIFICATION_COVERAGE', '只有链接时不生成内容标签和主题关联');
  const destination = plannedDestination || await classificationPath(state, lark, action.parent);
  if (input.basis === 'insufficient') assert(destination.path.length === 1, 'CLASSIFICATION_PARENT', '依据不足时放入已确认的大书架待整理，不猜二级主题分类');
  const relatedTopics = [], ids = new Set();
  for (const item of related) {
    const topic = state.documents.find(d => d.id === item.id && d.kind === 'topic' && active(d));
    assert(topic && topic.id !== source.id && !ids.has(topic.id), 'TOPIC', '关联必须是已索引的不同主题，且不能重复'); ids.add(topic.id);
    await lark.inScope(topic.url, state.readRoots); const fresh = await lark.fetch(topic.url);
    assert(item.hash === topic.hash && fresh.id === topic.id && hash(fresh.markdown) === item.hash, 'TOPIC_CHANGED', '主题版本已变化，重新核对后预览');
    const sourceEvidence = text(item.sourceEvidence, 500, 'TOPIC_EVIDENCE'), topicEvidence = text(item.topicEvidence, 500, 'TOPIC_EVIDENCE');
    assert(source.markdown.includes(sourceEvidence) && fresh.markdown.includes(topicEvidence), 'TOPIC_EVIDENCE', '关联依据必须分别出现在来源与主题正文中');
    relatedTopics.push({ id: topic.id, url: feishuURL(topic.url).url, title: topic.title, hash: item.hash, reason: text(item.reason, 300, 'TOPIC_EVIDENCE'), sourceEvidence, topicEvidence });
  }
  let proposedCategory = null;
  if (input.proposedCategory) {
    assert(input.status === 'pending' && hasContent && destination.path.length === 1, 'CLASSIFICATION_PROPOSAL', '新分类建议只用于有正文且暂存大书架的待整理资料');
    proposedCategory = { name: text(input.proposedCategory.name, 60, 'CLASSIFICATION_PROPOSAL'), reason: text(input.proposedCategory.reason, 300, 'CLASSIFICATION_PROPOSAL') };
    const catalog = await locations(state, lark, 1000);
    assert(catalog.complete, 'CLASSIFICATION_CATALOG', '目录不完整，不能认定需要新分类');
    assert(!catalog.items.some(d => key(d.title) === key(proposedCategory.name)), 'CLASSIFICATION_EXISTS', '已有同名分类或文档，先核对复用，不建议重复创建');
  }
  return { sourceId: source.id, sourceHash: source.hash, coverage: source.coverage, status: input.status, basis: input.basis, reason, evidence, tags, destination, relatedTopics, proposedCategory };
}

export function classificationMarkdown(c) {
  const lines = ['## 分类与关联', `整理状态：${c.status === 'classified' ? '已分类（基于本次读取）' : '待整理'}`, `资料覆盖：${escape(c.coverage)}`, `归档位置：${c.destination.path.map(d => escape(d.title)).join(' → ')}`, `分类理由：${escape(c.reason)}`, `标签：${c.tags.length ? c.tags.map(escape).join('、') : '暂无'}`];
  for (const t of c.relatedTopics) lines.push(`关联主题：[${escape(t.title)}](${t.url}) — ${escape(t.reason)}`);
  if (c.proposedCategory) lines.push(`新分类建议（尚未创建）：${escape(c.proposedCategory.name)} — ${escape(c.proposedCategory.reason)}`);
  return lines.join('\n\n');
}

export async function verifyClassification(state, lark, action, { deferDestination = false } = {}) {
  const c = action.classification; if (!c) return;
  requireNewSource(state, c.sourceId);
  if (!deferDestination) {
    const destination = await classificationPath(state, lark, action.parent);
    assert(hash(destination) === hash(c.destination), 'CLASSIFICATION_CHANGED', '分类名称或路径已变化，请重新预览');
  }
  for (const topic of c.relatedTopics) {
    await lark.inScope(topic.url, state.readRoots); const fresh = await lark.fetch(topic.url);
    assert(fresh.id === topic.id && hash(fresh.markdown) === topic.hash, 'TOPIC_CHANGED', '关联主题已变化，请重新核对分类预览');
  }
}

export const pendingContentClassification = documents => documents.filter(d => active(d) && d.classification?.status === 'pending').map(d => ({ id: d.id, title: d.title, url: d.url, reason: d.classification.reason, stale: d.classificationForHash !== d.hash }));
