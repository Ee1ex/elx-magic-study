import { hash, links, safeLink } from './store.mjs';

const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
const stop = new Set(['的', '了', '是', '在', '和', '与', '及', '我', '你', '怎么', '什么', 'the', 'a', 'an', 'and', 'or', 'to', 'of', 'is']);
export function tokenize(text) {
  const normalized = String(text || '').normalize('NFKC').toLowerCase();
  const result = [];
  for (const s of segmenter.segment(normalized)) if (s.isWordLike && !stop.has(s.segment)) result.push(s.segment);
  for (const m of normalized.matchAll(/[\p{Script=Han}]{2,}/gu)) for (let i = 0; i < m[0].length - 1; i++) { const t = m[0].slice(i, i + 2); if (!stop.has(t)) result.push(t); }
  return result;
}
export function chunks(document, size = 700) {
  const lines = (document.markdown || '').split('\n');
  const out = []; let heading = document.title || document.id, buffer = '', start = 1;
  function flush(end) { if (buffer.trim()) out.push({ id: `${document.id}:${start}`, docId: document.id, heading, text: buffer.trim(), startLine: start, endLine: end }); buffer = ''; }
  lines.forEach((line, i) => { if (/^#{1,6}\s/.test(line)) { flush(i); heading = line.replace(/^#+\s*/, ''); start = i + 1; } if (buffer.length + line.length > size && buffer) { flush(i); start = i + 1; } buffer += line + '\n'; });
  flush(lines.length); return out;
}
function frequencies(tokens) { const out = new Map(); for (const t of tokens) out.set(t, (out.get(t) || 0) + 1); return out; }
export function search(documents, queries, { limit = 8, expand = true } = {}) {
  const available = documents.filter(d => !d.unavailable && !d.outOfScope);
  const byId = new Map(available.map(d => [d.id, d]));
  const rows = available.flatMap(d => chunks(d)).map(c => ({ ...c, terms: frequencies(tokenize(c.text)), titleTerms: new Set(tokenize(byId.get(c.docId).title)) }));
  const df = new Map(); let totalLength = 0;
  for (const row of rows) { row.length = [...row.terms.values()].reduce((a, b) => a + b, 0); totalLength += row.length; for (const t of row.terms.keys()) df.set(t, (df.get(t) || 0) + 1); }
  const avg = totalLength / (rows.length || 1) || 1;
  const queryTerms = new Set(queries.flatMap(tokenize));
  const scored = rows.map(row => {
    let score = 0; const matched = [];
    for (const t of queryTerms) {
      const tf = row.terms.get(t) || 0;
      if (tf) { const idf = Math.log(1 + (rows.length - (df.get(t) || 0) + .5) / ((df.get(t) || 0) + .5)); score += idf * tf * 2.2 / (tf + 1.2 * (.25 + .75 * row.length / avg)); matched.push(t); }
      if (row.titleTerms.has(t)) score += 1.4;
    }
    for (const q of queries) if (q.trim() && (byId.get(row.docId).title || '').toLowerCase().includes(q.toLowerCase())) score += 3;
    return { ...row, score, matched };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score || a.docId.localeCompare(b.docId));
  const found = new Map();
  for (const row of scored) {
    if (found.size >= limit && !found.has(row.docId)) continue;
    if (!found.has(row.docId)) {
      const doc = byId.get(row.docId);
      found.set(row.docId, { id: doc.id, title: doc.title, url: doc.url, score: +row.score.toFixed(3), matchType: 'bm25', fetchedAt: doc.fetchedAt, revision: doc.revision, excerpts: [] });
    }
    const item = found.get(row.docId);
    if (item.excerpts.length < 2) item.excerpts.push({ heading: row.heading, startLine: row.startLine, endLine: row.endLine, text: row.text.slice(0, 1000), matched: row.matched.slice(0, 12) });
  }
  const neighbors = [];
  if (expand && found.size) {
    const graph = graphData(available, { maxNodes: 10000 });
    for (const e of graph.edges) { const adjacent = found.has(e.source) ? e.target : found.has(e.target) ? e.source : null;
      if (adjacent && !found.has(adjacent) && byId.has(adjacent) && !neighbors.some(d => d.id === adjacent)) { const d = byId.get(adjacent); neighbors.push({ id: d.id, title: d.title, url: d.url, via: found.has(e.source) ? e.source : e.target, relation: e.type }); }
    }
  }
  return { engine: 'local-bm25-zh', semanticEmbedding: false, cached: true, indexedDocuments: available.length, queries, results: [...found.values()], neighbors: neighbors.slice(0, 8), note: '分数仅为本次文本匹配排序；需读取正文判断语义与适用性。缓存中的行号不是飞书块锚点。' };
}
function matchURL(value) { try { const u = new URL(value); u.hash = ''; if (/\/wiki\/|\/docx\//.test(u.pathname)) return u.pathname.split('/').slice(1).join('/'); return u.href; } catch { return value; } }
export function graphData(documents, { maxNodes = 300, title = '我的知识图谱', demo = false } = {}) {
  const docs = documents.filter(d => !d.unavailable && !d.outOfScope);
  const selected = docs.slice(0, maxNodes);
  const nodes = selected.map(d => ({ id: d.id, title: d.title || d.id, kind: d.kind || 'document', url: safeLink(d.url), summary: (d.summary || '').slice(0, 400), fetchedAt: d.fetchedAt, coverage: d.coverage || 'unknown' }));
  const map = new Map();
  for (const d of selected) { if (d.url) map.set(matchURL(d.url), d.id); for (const alias of d.aliases || []) map.set(matchURL(alias), d.id); }
  const ids = new Set(nodes.map(n => n.id)); const edges = []; const edgeKeys = new Set(); const unresolved = [];
  function add(source, target, type, evidence) { if (!ids.has(target) || source === target) return; const key = `${source}/${target}/${type}`; if (!edgeKeys.has(key)) { edgeKeys.add(key); edges.push({ source, target, type, evidence: String(evidence || '').slice(0, 300) }); } }
  for (const d of selected) {
    for (const url of links(d.markdown || '')) {
      const target = map.get(matchURL(url)); if (target) add(d.id, target, '引用', url);
      else if (/\/(docx|wiki)\//.test(url)) unresolved.push({ source: d.id, url, reason: '未索引或不在本图范围，不等于链接失效' });
    }
    for (const r of d.relations || []) if (r.evidence) add(d.id, r.target, r.type || '关联', r.evidence);
  }
  return { schemaVersion: 1, title, demo, nodes, edges, unresolved, totalDocuments: docs.length, omitted: Math.max(0, docs.length - selected.length), note: '连线来自正文引用或带依据的显式关系；布局距离不代表知识相似度。仅包含本地已索引范围。' };
}
export function lint(documents, { staleDays = 180 } = {}) {
  const graph = graphData(documents, { maxNodes: 10000 }); const issues = [];
  const referenced = new Set(graph.edges.flatMap(e => [e.source, e.target])); const sources = new Map();
  for (const d of documents) {
    if (d.unavailable) issues.push({ id: d.id, type: 'unavailable', severity: 'warning', message: '上次远端读取失败，不能证明文档已删除' });
    if (!referenced.has(d.id)) issues.push({ id: d.id, type: 'isolated', severity: 'suggestion', message: '在当前索引范围没有引用关系；不是删除依据' });
    if (d.sourceUrl) { const old = sources.get(d.sourceUrl); if (old) issues.push({ id: d.id, type: 'duplicate-source', related: old, severity: 'suggestion' }); sources.set(d.sourceUrl, d.id); }
    if (d.coverage === 'link_only' || !d.markdown) issues.push({ id: d.id, type: 'content-missing', severity: 'info' });
    if (['topic', 'experience'].includes(d.kind) && !links(d.markdown || '').length && !d.relations?.length) issues.push({ id: d.id, type: 'no-sources', severity: 'suggestion' });
    const checked = Date.parse(d.verifiedAt || d.fetchedAt || '');
    if (Number.isFinite(checked) && Date.now() - checked > staleDays * 86400000) issues.push({ id: d.id, type: 'review-age', severity: 'suggestion', message: '长期未核对，仅提示复查，不认定内容错误' });
  }
  for (const item of graph.unresolved) issues.push({ id: item.source, type: 'unresolved-link', severity: 'suggestion', url: item.url, message: item.reason });
  return { mode: 'local-cache-read-only', documents: documents.length, issues, signature: hash(issues), semanticReview: '矛盾、条件差异和时效真实性由 Agent 读取原文后判断；脚本未自动判定。' };
}
