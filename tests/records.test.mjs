import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { bind, bindAreas, makePlan, applyPlan, recoverPlan, fetchDocument, intakeQueue } from '../skills/elx-magic-study/scripts/library-core.mjs';
import { Lark } from '../skills/elx-magic-study/scripts/lark.mjs';
import { hash, loadLibrary, saveLibrary, issue } from '../skills/elx-magic-study/scripts/store.mjs';
import { markdownTables, rowMarkdown, nativeTable, prepareRecord, searchRecords, recordContext } from '../skills/elx-magic-study/scripts/records.mjs';
import { classificationPath, classificationContext } from '../skills/elx-magic-study/scripts/classification.mjs';
import { verificationText } from '../skills/elx-magic-study/scripts/verification.mjs';
import { run } from '../skills/elx-magic-study/scripts/library.mjs';

const wiki = id => `https://example.feishu.cn/wiki/${id}`;
class RecordLark extends Lark {
  constructor() { super(); this.docs = new Map(); this.writes = 0; this.add('Root', '首页', null); this.add('Links', '链接资料', 'Root'); this.add('Personal', '个人记录', 'Root'); this.add('Snacks', '零食推荐', 'Personal', '# 零食推荐\n\n## 干脆\n\n| 名称 | 品牌 | 用户备注 |\n|---|---|---|\n| 玉米片 | 示例品牌 | 用户原话 |\n\n保留这段做法。'); }
  add(id, title, parent, markdown = '用途说明') { const d = { id, title, parent, markdown, revision: 1, url: wiki(id) }; this.docs.set(id, d); return d; }
  async identity() { return { account: 'records-fixture', status: 'valid' }; }
  async node(url) { const d = this.docs.get(url.split('/').at(-1)); assert.ok(d); return { node_token: d.id, obj_token: d.id, space_id: '1', parent_node_token: d.parent, title: d.title, obj_type: 'docx', has_child: [...this.docs.values()].some(c => c.parent === d.id) }; }
  async children(parent) { return { items: await Promise.all([...this.docs.values()].filter(d => d.parent === parent.node_token).map(d => this.node(d.url))), has_more: false }; }
  async fetch(url) { return structuredClone(this.docs.get(url.split('/').at(-1))); }
  async create(parent, title, markdown) { const d = this.add('Created' + ++this.writes, title, parent, markdown); return { data: { document: { document_id: d.id, url: d.url }, result: 'success', warnings: [] } }; }
  async recordTables(url) { const document = await this.fetch(url); return { document, tables: markdownTables(document.markdown).tables.map((t, i) => ({ ...t, id: 'Table' + (i + 1), cells: Array.from({ length: (t.rows.length + 1) * t.headers.length }, (_, j) => 'Cell' + j) })) }; }
  async recordAppend(url, a) { const d = this.docs.get(url.split('/').at(-1)), parsed = markdownTables(d.markdown); parsed.lines.splice(parsed.tables[0].end, 0, rowMarkdown(a.values)); d.markdown = parsed.lines.join('\n'); d.revision++; this.writes++; if (this.throwAfterRow) throw issue('TIMEOUT', '合成未知结果'); if (this.damage) d.markdown = d.markdown.replace('用户原话', '被改动'); return { data: { document: { document_id: d.id, url }, result: 'success', warnings: [] } }; }
}
async function fixture() { const home = path.join(os.tmpdir(), 'elx-records-tests', randomUUID()), lark = new RecordLark(); await bind(home, { id: 'test', readRoots: [wiki('Root')], writeRoot: wiki('Root'), confirmed: true }, lark); await bindAreas(home, 'test', { links: wiki('Links'), personal: wiki('Personal'), confirmed: true }, lark); return { home, lark }; }

const recordSpec = fields => ({ actions: [{ kind: 'record_append', doc: wiki('Snacks'), tableId: 'Table1', fields: fields || { 名称: '米饼', 品牌: '合成品牌', 用户备注: '朋友推荐，还没吃过' } }] });

test('REQ-020 个人分类文档无需外部链接或虚构实践来源', async () => {
  const f = await fixture();
  const p = await makePlan(f.home, 'test', { actions: [{ kind: 'create', category: 'personal', title: '礼物推荐', parent: wiki('Personal'), content: '# 礼物推荐\n\n| 名称 | 品牌 | 用户备注 |\n|---|---|---|' }] }, f.lark);
  assert.equal(p.actions[0].category, 'personal'); assert.deepEqual(p.sources, []);
  await applyPlan(f.home, 'test', p.plan, p.digest, f.lark); const saved = (await loadLibrary(f.home, 'test')).documents[0]; assert.equal(saved.kind, 'personal'); assert.equal(saved.contentArea, 'personal');
});

test('REQ-020 表格追加复用已有三列，保留用户原话和表格外正文', async () => {
  const f = await fixture();
  const p = await makePlan(f.home, 'test', { actions: [{ kind: 'record_append', doc: wiki('Snacks'), tableId: 'Table1', fields: { 名称: '米饼', 品牌: '合成品牌', 用户备注: '朋友推荐，还没吃过' } }] }, f.lark);
  assert.equal(p.actions[0].kind, 'record_append'); assert.equal(p.actions[0].fields.用户备注, '朋友推荐，还没吃过');
  await applyPlan(f.home, 'test', p.plan, p.digest, f.lark); assert.ok(f.lark.docs.get('Snacks').markdown.includes('保留这段做法。')); assert.ok(f.lark.docs.get('Snacks').markdown.includes('用户原话')); assert.equal(markdownTables(f.lark.docs.get('Snacks').markdown).tables[0].rows.length, 2);
  await applyPlan(f.home, 'test', p.plan, p.digest, f.lark); assert.equal(f.lark.writes, 1);
});

test('REQ-020 空品牌可记录，未知列先建议且重复名称品牌不另建条目', async () => {
  const f = await fixture(); const p = await makePlan(f.home, 'test', recordSpec({ 名称: '米饼', 用户备注: '还没买过' }), f.lark); assert.equal(p.actions[0].values[1], '');
  await assert.rejects(makePlan(f.home, 'test', recordSpec({ 名称: '米饼', 热量: '待查' }), f.lark), e => e.code === 'RECORD_FIELDS');
  await assert.rejects(makePlan(f.home, 'test', recordSpec({ 名称: '玉米片', 品牌: '示例品牌', 用户备注: '新备注' }), f.lark), e => e.code === 'DUPLICATE_RECORD');
  await assert.rejects(makePlan(f.home, 'test', recordSpec({ 品牌: '示例品牌' }), f.lark), e => e.code === 'RECORD_NAME'); assert.equal(f.lark.writes, 0);
});

test('REQ-020 表头可扩展且只写对应现有列，用户备注不被补查数据覆盖', async () => {
  const f = await fixture(), d = f.lark.docs.get('Snacks'); d.markdown = '# 合成\n\n| 品名 | 品牌／规格 | 备注 | 参考价 |\n|-|-|-|-|\n| 饼干 | 合成牌 | 我的原话 | 9元（旧记录） |';
  const spec = recordSpec({ 品名: '米饼', '品牌／规格': '20g合成包', 备注: '朋友推荐；尚未尝试', 参考价: '3元（合成例子）' });
  const p = await makePlan(f.home, 'test', spec, f.lark); await applyPlan(f.home, 'test', p.plan, p.digest, f.lark); assert.ok(d.markdown.includes('我的原话')); assert.equal(markdownTables(d.markdown).tables[0].headers.length, 4);
});

test('REQ-020 人工并发与分区变化阻断旧计划，禁止跨区表格追加', async () => {
  const f = await fixture(), p = await makePlan(f.home, 'test', recordSpec(), f.lark); f.lark.docs.get('Snacks').markdown += '\n用户另写'; await assert.rejects(applyPlan(f.home, 'test', p.plan, p.digest, f.lark), e => e.code === 'CONCURRENT_EDIT'); assert.equal(f.lark.writes, 0);
  const g = await fixture(), q = await makePlan(g.home, 'test', recordSpec(), g.lark); g.lark.docs.get('Personal').title = '已改名'; await assert.rejects(applyPlan(g.home, 'test', q.plan, q.digest, g.lark), e => e.code === 'CONTENT_AREAS_CHANGED');
  const h = await fixture(); h.lark.docs.get('Snacks').parent = 'Links'; await assert.rejects(makePlan(h.home, 'test', recordSpec(), h.lark), e => e.code === 'RECORD_DOCUMENT');
  const j = await fixture(), r = await makePlan(j.home, 'test', recordSpec(), j.lark); j.lark.docs.get('Snacks').parent = 'Links'; await assert.rejects(applyPlan(j.home, 'test', r.plan, r.digest, j.lark), e => e.code === 'RECORD_DOCUMENT'); assert.equal(j.lark.writes, 0);
});

test('REQ-020 结果未知只读恢复，不重复插入；旧备注被改动不能报成功', async () => {
  const f = await fixture(), p = await makePlan(f.home, 'test', recordSpec(), f.lark); f.lark.throwAfterRow = true; await assert.rejects(applyPlan(f.home, 'test', p.plan, p.digest, f.lark), e => e.code === 'WRITE_UNCERTAIN'); await assert.rejects(applyPlan(f.home, 'test', p.plan, p.digest, f.lark), e => e.code === 'UNKNOWN_WRITE');
  assert.equal((await recoverPlan(f.home, 'test', p.plan, 1, wiki('Snacks'), f.lark)).state, 'complete'); assert.equal(f.lark.writes, 1);
  const g = await fixture(), q = await makePlan(g.home, 'test', recordSpec(), g.lark); g.lark.damage = true; await assert.rejects(applyPlan(g.home, 'test', q.plan, q.digest, g.lark), e => e.code === 'WRITE_UNCERTAIN'); await assert.rejects(recoverPlan(g.home, 'test', q.plan, 1, wiki('Snacks'), g.lark), e => e.code === 'VERIFY_FAILED');
});

test('REQ-020 未核实写入不能换新计划绕过；分区绑定改变阻断已预览动作', async () => {
  const f = await fixture(), p = await makePlan(f.home, 'test', recordSpec(), f.lark); f.lark.throwAfterRow = true; await assert.rejects(applyPlan(f.home, 'test', p.plan, p.digest, f.lark)); await assert.rejects(makePlan(f.home, 'test', recordSpec({ 名称: '其他零食' }), f.lark), e => e.code === 'UNKNOWN_WRITE'); assert.equal(f.lark.writes, 1);
  const g = await fixture(), q = await makePlan(g.home, 'test', recordSpec(), g.lark), state = await loadLibrary(g.home, 'test'); state.contentAreas.personal.title = '不同绑定'; await saveLibrary(g.home, state); await assert.rejects(applyPlan(g.home, 'test', q.plan, q.digest, g.lark), e => e.code === 'CONTENT_AREAS_CHANGED'); assert.equal(g.lark.writes, 0);
});

test('REQ-020 Wiki与docx别名仍是同一文档，未核实写入不能换链接绕过', async () => {
  const f = await fixture(), p = await makePlan(f.home, 'test', recordSpec(), f.lark); f.lark.throwAfterRow = true; await assert.rejects(applyPlan(f.home, 'test', p.plan, p.digest, f.lark)); const spec = recordSpec({ 名称: '其他零食' }); spec.actions[0].doc = 'https://example.feishu.cn/docx/Snacks'; await assert.rejects(makePlan(f.home, 'test', spec, f.lark), e => e.code === 'UNKNOWN_WRITE'); assert.equal(f.lark.writes, 1);
});

test('REQ-020 复用不同表头，品牌不适用时不强制增加空列', async () => {
  const f = await fixture(), d = f.lark.docs.get('Snacks'); d.markdown = '| 名称 | 我的备注 |\n|-|-|\n| 聚会小游戏 | 六个人可玩 |'; const p = await makePlan(f.home, 'test', recordSpec({ 名称: '合成小游戏', 我的备注: '朋友推荐' }), f.lark); await applyPlan(f.home, 'test', p.plan, p.digest, f.lark); assert.deepEqual(markdownTables(d.markdown).tables[0].headers, ['名称', '我的备注']);
});

test('REQ-020 分区绑定不移动旧库，主题最多两层且未登记容器不放宽深度', async () => {
  const f = await fixture(), state = await loadLibrary(f.home, 'test'); f.lark.add('Theme', '生活与出行', 'Links'); f.lark.add('Sub', '饮食', 'Theme'); f.lark.add('Deep', '第三层', 'Sub');
  assert.equal((await classificationPath(state, f.lark, wiki('Sub'))).path.length, 3); await assert.rejects(classificationPath(state, f.lark, wiki('Deep')), e => e.code === 'CLASSIFICATION_DEPTH');
  f.lark.add('Old', '旧主题', 'Root'); f.lark.add('OldSub', '旧子类', 'Old'); f.lark.add('OldDeep', '旧第三层', 'OldSub'); await assert.rejects(classificationPath(state, f.lark, wiki('OldDeep')), e => e.code === 'CLASSIFICATION_DEPTH');
  assert.equal(f.lark.writes, 0); await assert.rejects(bindAreas(f.home, 'test', { links: wiki('Links'), personal: wiki('Links'), confirmed: true }, f.lark), e => e.code === 'CONTENT_AREAS_SCOPE');
});

test('REQ-020 同步手工新建个人文档归属，链接分类上下文只取链接区', async () => {
  const f = await fixture(), state = await loadLibrary(f.home, 'test'), d = f.lark.docs.get('Snacks'); state.documents.push({ ...d, kind: 'document', hash: hash(d.markdown), remote: true }); await saveLibrary(f.home, state); assert.equal((await fetchDocument(f.home, 'test', 'Snacks', f.lark)).contentArea, 'personal');
  f.lark.add('Theme', '生活主题', 'Links'); const src = { id: 'src-test', kind: 'source', recordRole: 'input', remote: false, markdown: '生活资料正文', hash: hash('生活资料正文'), coverage: 'full_text' }; const s = await loadLibrary(f.home, 'test'); s.documents.push(src); await saveLibrary(f.home, s);
  const c = await classificationContext(f.home, 'test', src.id, { supplied: f.lark }); assert.ok(c.locations.items.every(x => x.path[0].nodeToken === 'Links')); assert.ok(!c.locations.items.some(x => x.nodeToken === 'Snacks'));
});

test('REQ-020 表格解析跳过代码示例，检查已有列和缺口但不扩列', () => {
  const d = { id: 'a', title: '个人零食', kind: 'personal', markdown: '# 零食\n```md\n| 名称 | 品牌 | 备注 |\n|-|-|-|\n| 示例 | 示例 | 示例 |\n```\n## 干脆\n| 名称 | 品牌 | 备注 |\n|-|-|-|\n| 饼干 | | 朋友推荐 |' }; const c = recordContext([d], 'a'); assert.equal(c.tables.length, 1); assert.equal(c.tables[0].count, 1); assert.equal(c.tables[0].missing.品牌, 1); assert.deepEqual(c.tables[0].headers, ['名称', '品牌', '备注']);
});

test('REQ-020 表头粗体不影响条目查询，已移出个人区的不作为个人候选或来源队列', () => {
  const d = { id: 'a', kind: 'personal', contentArea: 'personal', markdown: '| **名称** | **品牌** | **用户备注** |\n|-|-|-|\n| 米饼 | 合成牌 | 朋友推荐 |' }; assert.equal(searchRecords([d], ['米饼']).results[0].fields.名称, '米饼'); assert.equal(searchRecords([{ ...d, contentArea: 'links' }], ['米饼']).eligibleCount, 0); assert.equal(intakeQueue([d]).needsClassification.length, 0);
});

test('REQ-020 分区内待整理仍为一级，分类父步骤允许两层主题并回读正确位置', async () => {
  const f = await fixture(); f.lark.add('Pending', '待整理', 'Links'); const state = await loadLibrary(f.home, 'test'), source = { id: 'src-unknown', kind: 'source', recordRole: 'input', remote: false, markdown: '只有合成链接', hash: hash('只有合成链接'), coverage: 'link_only' }; state.documents.push(source); await saveLibrary(f.home, state);
  const p = await makePlan(f.home, 'test', { actions: [{ kind: 'create', category: 'source', titleSummary: '合成资料待获取', parent: wiki('Pending'), content: '仅链接，待取得正文。', classification: { sourceId: source.id, sourceHash: source.hash, status: 'pending', basis: 'insufficient', reason: '只有链接', tags: [], relatedTopics: [] } }] }, f.lark); assert.equal(p.actions[0].classification.destination.path.length, 2); await applyPlan(f.home, 'test', p.plan, p.digest, f.lark);
  const g = await fixture(), s = await loadLibrary(g.home, 'test'), input = { ...source, id: 'src-content', coverage: 'full_text', markdown: '合成资料讨论日常饮食', hash: hash('合成资料讨论日常饮食') }; s.documents.push(input); await saveLibrary(g.home, s);
  const q = await makePlan(g.home, 'test', { actions: [{ kind: 'create', category: 'shelf', parent: wiki('Links'), title: '生活主题', content: '生活内容' }, { kind: 'create', category: 'shelf', parentStep: 1, title: '饮食主题', content: '饮食内容' }, { kind: 'create', category: 'source', parentStep: 2, titleSummary: '合成饮食资料', content: '资料内容', classification: { sourceId: input.id, sourceHash: input.hash, status: 'classified', basis: 'content', reason: '讨论饮食', evidence: '日常饮食', tags: [], relatedTopics: [] } }] }, g.lark); await applyPlan(g.home, 'test', q.plan, q.digest, g.lark); assert.equal(g.lark.docs.get('Created3').parent, 'Created2');
});

test('REQ-020 条目级城市品牌筛选与随机池，来源资料及未知热量不伪装合格', () => {
  const docs = [{ id: 'a', title: '餐厅', contentArea: 'personal', hash: 'v1', markdown: '| 名称 | 品牌 | 备注 | 城市 |\n|-|-|-|-|\n| 椰子鸡 | 合成牌 | 待尝试 | 深圳 |\n| 面馆 | 合成牌 | 用户备注 | 广州 |\n| 小吃 | 合成牌 | 朋友推荐 | 深圳 |' }, { id: 'b', title: '链接来源', kind: 'source', markdown: '| 名称 | 品牌 | 备注 | 城市 |\n|-|-|-|-|\n| 来源餐厅 | 合成牌 | 仅来源观点 | 深圳 |' }];
  const pool = searchRecords(docs, [], { filters: { 城市: '深圳' } }); assert.equal(pool.eligibleCount, 2); assert.ok(pool.results.every(r => r.documentId === 'a'));
  const sampled = searchRecords(docs, [], { filters: { 城市: '深圳' }, random: true, eligibleIds: [pool.results[1].id], limit: 1 }); assert.equal(sampled.results[0].id, pool.results[1].id); assert.equal(sampled.cached, true);
  assert.throws(() => searchRecords(docs, [], { random: true, eligibleIds: ['过时编号'] }), e => e.code === 'RECORD_CANDIDATES_CHANGED'); assert.equal(searchRecords(docs, [], { filters: { 热量: '50kcal' } }).eligibleCount, 0);
});

test('REQ-020 品牌大小写不重复，正文版本变化使旧合格池失效', async () => {
  const f = await fixture(), d = f.lark.docs.get('Snacks'); d.markdown = d.markdown.replace('示例品牌', 'DemoBrand'); await assert.rejects(makePlan(f.home, 'test', recordSpec({ 名称: '玉米片', 品牌: 'demobrand' }), f.lark), e => e.code === 'DUPLICATE_RECORD');
  const doc = { id: 'a', kind: 'personal', hash: 'old-body', markdown: d.markdown }, old = searchRecords([doc], []).results[0].id; assert.throws(() => searchRecords([{ ...doc, hash: 'updated-source-note' }], [], { eligibleIds: [old], random: true }), e => e.code === 'RECORD_CANDIDATES_CHANGED');
});

test('REQ-020 CLI离线条目检索和上下文真实可用，不调用飞书', async () => {
  const f = await fixture(), state = await loadLibrary(f.home, 'test'), d = f.lark.docs.get('Snacks'); state.provider = 'demo'; state.documents.push({ ...d, kind: 'personal', hash: hash(d.markdown) }); await saveLibrary(f.home, state);
  const result = await run(['record-search', '--home', f.home, '--library', 'test', '--query', '玉米片', '--random', '--offline']); assert.equal(result.results.length, 1); assert.equal(result.results[0].fields.名称, '玉米片'); const c = await run(['record-context', '--home', f.home, '--library', 'test', '--id', 'Snacks', '--offline']); assert.equal(c.tables[0].count, 1); assert.equal(f.lark.writes, 0);
});

function nativeFixture({ emptyChildren = false, failAfterInsert = false } = {}) {
  const headers = ['名称', '品牌', '用户备注'], rows = [['玉米片', '合成品牌', '保留用户备注']], calls = []; let revision = 1;
  const blocks = () => {
    const matrix = [headers, ...rows], all = [{ block_id: 'Table1', block_type: 31, table: { property: { row_size: matrix.length, column_size: 3 }, cells: matrix.flatMap((r, i) => r.map((_, j) => `Cell${i}x${j}`)) } }];
    matrix.forEach((r, i) => r.forEach((value, j) => { const textId = `Text${i}x${j}`, absent = emptyChildren && i === matrix.length - 1 && i > 1 && !value; all.push({ block_id: `Cell${i}x${j}`, block_type: 32, children: absent ? [] : [textId] }); if (!absent) all.push({ block_id: textId, block_type: 2, text: { elements: [{ text_run: { content: value, ...(i === 1 ? { text_element_style: { bold: true } } : {}) } }] } }); })); return all;
  };
  const markdown = () => '# 合成记录\n\n' + [rowMarkdown(headers), '|---|---|---|', ...rows.map(rowMarkdown)].join('\n') + '\n\n保留表格外正文。';
  const lark = new Lark(null, async (args, options) => {
    assert.equal(args[args.indexOf('--as') + 1], 'user'); calls.push({ args, input: options.input });
    if (args[0] === 'docs') return { data: { document: { document_id: 'Doc1', url: wiki('Doc1'), revision_id: revision, content: markdown() }, warnings: [] } };
    assert.equal(args[0], 'api'); const method = args[1], route = args[2], body = options.input ? JSON.parse(options.input) : null, params = JSON.parse(args[args.indexOf('--params') + 1]);
    if (method === 'GET') return { data: { code: 0, data: { items: blocks(), has_more: false } } };
    assert.match(params.client_token, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/); assert.ok(!['DELETE', 'PUT'].includes(method));
    if (body?.insert_table_row) { assert.equal(body.insert_table_row.row_index, -1); rows.push(['', '', '']); revision++; if (failAfterInsert) throw issue('TIMEOUT', '合成插入回执丢失'); }
    else if (body?.requests) { for (const r of body.requests) { const m = r.block_id.match(/^Text(\d+)x(\d+)$/); assert.equal(Number(m[1]), rows.length); rows[Number(m[1]) - 1][Number(m[2])] = r.update_text_elements.elements[0].text_run.content; } revision++; }
    else { assert.equal(method, 'POST'); const m = route.match(/Cell(\d+)x(\d+)\/children$/); assert.ok(m); assert.equal(Number(m[1]), rows.length); rows[Number(m[1]) - 1][Number(m[2])] = body.children[0].text.elements[0].text_run.content; revision++; }
    return { data: { code: 0, data: { document_revision_id: revision } } };
  });
  return { lark, rows, calls, blocks, markdown };
}

test('REQ-020 原生接口模拟编排只插入新行并填新单元格，旧块与正文保留', async () => {
  const f = nativeFixture(), live = await f.lark.recordTables(wiki('Doc1')), old = f.blocks().filter(b => b.block_id.startsWith('Text1'));
  const action = { ...prepareRecord(live.document, live.tables[0], { 名称: '米饼 | 小包', 品牌: '合成牌', 用户备注: '朋友推荐；还没尝试' }), baseHash: hash(live.document.markdown) };
  await f.lark.recordAppend(wiki('Doc1'), action); assert.equal(f.rows.length, 2); assert.deepEqual(f.blocks().filter(b => b.block_id.startsWith('Text1')), old); assert.equal(hash(verificationText(f.markdown())), action.expectedTextHash);
  assert.equal(f.calls.filter(c => c.args[1] === 'PATCH').length, 2); assert.ok(f.calls.every(c => !c.args.includes('overwrite')));
});

test('REQ-020 插入后无默认文本块时只在新空单元格创建正文', async () => {
  const f = nativeFixture({ emptyChildren: true }), live = await f.lark.recordTables(wiki('Doc1')); const action = { ...prepareRecord(live.document, live.tables[0], { 名称: '米饼', 用户备注: '用户新记录' }), baseHash: hash(live.document.markdown) }; await f.lark.recordAppend(wiki('Doc1'), action); assert.equal(f.rows[1][0], '米饼'); assert.equal(f.rows[1][1], ''); assert.equal(f.calls.filter(c => c.args[1] === 'POST').length, 2);
});

test('REQ-020 插入行回执丢失停止填充，再次调用基线阻断而不插第二行', async () => {
  const f = nativeFixture({ failAfterInsert: true }), live = await f.lark.recordTables(wiki('Doc1')), action = { ...prepareRecord(live.document, live.tables[0], { 名称: '米饼' }), baseHash: hash(live.document.markdown) }; await assert.rejects(f.lark.recordAppend(wiki('Doc1'), action), e => e.code === 'TIMEOUT'); await assert.rejects(f.lark.recordAppend(wiki('Doc1'), action), e => e.code === 'CONCURRENT_EDIT'); assert.equal(f.calls.filter(c => c.args[1] === 'PATCH').length, 1); assert.equal(f.rows.length, 2);
});

test('REQ-020 合并或资源单元格不做普通追加，重复表格不能猜位置', () => {
  const f = nativeFixture(), b = f.blocks(); b[0].table.property.merge_info = [{}]; assert.throws(() => nativeTable(b, 'Table1'), e => e.code === 'RECORD_TABLE');
  const other = f.blocks(); other.find(b => b.block_id === 'Text1x0').text.elements = [{ mention_doc: { token: 'SYNTHETIC' } }]; assert.throws(() => nativeTable(other, 'Table1'), e => e.code === 'RECORD_RICH_CELL');
  const table = nativeTable(f.blocks(), 'Table1'); assert.throws(() => prepareRecord({ markdown: f.markdown() + '\n\n' + f.markdown() }, table, { 名称: '米饼' }), e => e.code === 'RECORD_TABLE_AMBIGUOUS');
});
