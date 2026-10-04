import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import * as core from '../skills/elx-magic-study/scripts/library-core.mjs';
import { Lark } from '../skills/elx-magic-study/scripts/lark.mjs';
import { hash, loadLibrary, saveLibrary, libraryPath } from '../skills/elx-magic-study/scripts/store.mjs';
import { search, graphData } from '../skills/elx-magic-study/scripts/retrieval.mjs';

const origin = 'https://example.feishu.cn';
const wiki = id => `${origin}/wiki/${id}`;
const body = 'Agent 可以按需读取资料，减少上下文占用。保留来源，方便追溯。';
class FixtureLark extends Lark {
  constructor() {
    super(); this.docs = new Map(); this.writes = 0;
    this.add('Root', '书屋', null); this.add('Sources', '收件箱与来源', 'Root');
    this.add('AI', 'AI与Agent', 'Sources'); this.add('Topics', '主题知识', 'Root');
    this.add('Context', '上下文管理', 'Topics', '按需读取资料，避免上下文拥挤。');
  }
  add(id, title, parent, markdown = '书架说明') { const d = { id, title, parent, markdown, revision: 1, url: wiki(id) }; this.docs.set(id, d); return d; }
  async identity() { return { account: 'fixture', status: 'valid' }; }
  async node(url) { const d = this.docs.get(url.split('/').at(-1)); assert.ok(d, 'fixture node exists'); return { node_token: d.id, obj_token: d.id, space_id: '1', parent_node_token: d.parent, title: d.title, obj_type: 'docx', has_child: [...this.docs.values()].some(c => c.parent === d.id) }; }
  async children(parent) { return { items: await Promise.all([...this.docs.values()].filter(d => d.parent === parent.node_token).map(d => this.node(d.url))), has_more: false }; }
  async fetch(url) { return structuredClone(this.docs.get(url.split('/').at(-1))); }
  async create(parent, title, markdown) { const d = this.add(`Created${++this.writes}`, title, parent, markdown); return { data: { document: { document_id: d.id, url: d.url }, result: 'success' } }; }
}
async function fixture({ linkOnly = false } = {}) {
  const home = path.resolve('artifacts/test-runs/classification', randomUUID()), lark = new FixtureLark();
  await core.bind(home, { id: 'test', readRoots: [wiki('Root')], writeRoot: wiki('Root'), confirmed: true }, lark);
  const captured = await core.capture(home, 'test', { url: 'https://example.com/article', title: '如何节省上下文' });
  if (!linkOnly) await core.sourceContent(home, 'test', captured.id, { markdown: body, coverage: 'full_text', sourceNote: '合成正文' });
  const state = await loadLibrary(home, 'test'), topic = lark.docs.get('Context');
  state.documents.push({ ...topic, hash: hash(topic.markdown), kind: 'topic', recordRole: 'derived', remote: true, coverage: 'full_text' });
  await saveLibrary(home, state);
  const source = state.documents.find(d => d.id === captured.id);
  const classification = { sourceId: source.id, sourceHash: source.hash, status: 'classified', basis: 'content', reason: '讲解 Agent 如何减少上下文占用。', evidence: '按需读取资料', tags: ['Agent', '上下文管理'], relatedTopics: [{ id: topic.id, hash: hash(topic.markdown), reason: '均讨论按需读取', sourceEvidence: '按需读取资料', topicEvidence: '按需读取资料' }] };
  const spec = { actions: [{ kind: 'create', category: 'source', title: '来源笔记：节省上下文', parent: wiki('AI'), content: '按需读取资料可以节省上下文。', classification }] };
  return { home, lark, source, spec, classification };
}

test('REQ-016 标题保留具体对象、最多10字符，分类取真实末级并同步正文首标题', async () => {
  const f = await fixture(), a = f.spec.actions[0]; delete a.title;
  a.titleSummary = 'OPPO耳机耳帽选购'; a.content = '# 原先标题\n\n正文保留';
  const p = await core.makePlan(f.home, 'test', f.spec, f.lark);
  assert.equal(p.actions[0].title, 'OPPO耳机耳帽选购丨AI与Agent');
  assert.ok(p.actions[0].content.startsWith('# OPPO耳机耳帽选购丨AI与Agent\n\n正文保留'));
  await core.applyPlan(f.home, 'test', p.plan, p.digest, f.lark);
  assert.equal(f.lark.docs.get('Created1').title, p.actions[0].title);
  assert.equal(core.formatNoteTitle('LLM知识库方法', '知识管理'), 'LLM知识库方法丨知识管理');
  for (const s of ['OPPO耳机耳帽选购指南', '摘要丨伪分类', '摘要｜伪分类', '摘要\n换行', '']) assert.throws(() => core.formatNoteTitle(s, '数码'), e => e.code === 'NOTE_TITLE');
});

test('REQ-016 新分类父步骤可生成标题，拒绝伪后缀、缺分类与完整标题冲突', async () => {
  const f = await emptyLibrary(); delete f.spec.actions[1].title; f.spec.actions[1].titleSummary = '按需读取节省上下文';
  const p = await core.makePlan(f.home, 'test', f.spec, f.lark);
  assert.equal(p.actions[1].title, '按需读取节省上下文丨AI与效率');
  await core.applyPlan(f.home, 'test', p.plan, p.digest, f.lark);
  for (const change of [a => { a.title = '任意标题丨伪分类'; }, a => { delete a.classification; }]) {
    const g = await fixture(); g.spec.actions[0].titleSummary = '按需读取节省上下文'; change(g.spec.actions[0]);
    await assert.rejects(core.makePlan(g.home, 'test', g.spec, g.lark), e => ['NOTE_TITLE','NOTE_CLASSIFICATION'].includes(e.code)); assert.equal(g.lark.writes, 0);
  }
  const g = await fixture(); g.spec.actions[0].titleSummary = '按需读取节省上下文'; delete g.spec.actions[0].title;
  g.lark.add('Existing', '按需读取节省上下文丨AI与Agent', 'AI');
  await assert.rejects(core.makePlan(g.home, 'test', g.spec, g.lark), e => e.code === 'DUPLICATE_TITLE');
});

async function emptyLibrary() {
  const f = await fixture();
  for (const id of [...f.lark.docs.keys()]) if (id !== 'Root') f.lark.docs.delete(id);
  const state = await loadLibrary(f.home, 'test'); state.documents = [f.source]; await saveLibrary(f.home, state);
  f.classification.relatedTopics = [];
  f.spec.actions = [
    { kind: 'create', category: 'shelf', title: 'AI与效率', content: '收录 AI 工具和效率方法。' },
    { kind: 'create', category: 'source', parentStep: 1, title: '来源笔记：首次整理', content: '按需读取资料可以节省上下文。', classification: f.classification }
  ];
  return f;
}

test('REQ-015 空库分类和笔记一次预览，真实父节点落库且重复执行不重建', async () => {
  const f = await emptyLibrary(), p = await core.makePlan(f.home, 'test', f.spec, f.lark);
  assert.equal(f.lark.writes, 0); assert.equal(p.actions[1].parentStep, 1);
  assert.equal(p.actions[1].classification.destination.path[0].title, 'AI与效率');
  assert.equal(p.actions[1].classification.destination.path[0].url, undefined);
  const result = await core.applyPlan(f.home, 'test', p.plan, p.digest, f.lark);
  assert.equal(result.state, 'complete'); assert.equal(f.lark.docs.get('Created2').parent, 'Created1');
  const state = await loadLibrary(f.home, 'test');
  assert.equal(state.documents.find(d => d.id === 'Created1').recordRole, 'navigation');
  assert.equal(state.documents.find(d => d.id === 'Created2').classification.destination.url, wiki('Created1'));
  const stored = JSON.parse(await fs.readFile(path.join(libraryPath(f.home, 'test'), 'operations', p.plan + '.json'), 'utf8'));
  assert.equal(stored.digest, p.digest); assert.equal(core.planDigest(stored.payload), p.digest);
  await core.applyPlan(f.home, 'test', p.plan, p.digest, f.lark); assert.equal(f.lark.writes, 2);
});

test('REQ-015 两层分类按前序依赖创建，拒绝前向引用、非分类父步骤和第三层', async () => {
  const f = await emptyLibrary();
  f.spec.actions.splice(1, 0, { kind: 'create', category: 'shelf', parentStep: 1, title: '上下文方法', content: '收录上下文管理。' });
  f.spec.actions[2].parentStep = 2;
  const p = await core.makePlan(f.home, 'test', f.spec, f.lark);
  await core.applyPlan(f.home, 'test', p.plan, p.digest, f.lark); assert.equal(f.lark.docs.get('Created3').parent, 'Created2');
  for (const change of [s => { s.actions[1].parentStep = 2; }, s => { s.actions[0].category = 'document'; }, s => { s.actions[1].parent = wiki('Root'); }]) {
    const g = await emptyLibrary(); change(g.spec); await assert.rejects(core.makePlan(g.home, 'test', g.spec, g.lark)); assert.equal(g.lark.writes, 0);
  }
  const g = await emptyLibrary();
  g.spec.actions = [g.spec.actions[0], { kind: 'create', category: 'shelf', parentStep: 1, title: '二层', content: '分类说明' }, { kind: 'create', category: 'shelf', parentStep: 2, title: '三层', content: '分类说明' }];
  await assert.rejects(core.makePlan(g.home, 'test', g.spec, g.lark), e => e.code === 'CLASSIFICATION_DEPTH');
});

test('REQ-015 分类创建响应丢失时停止，查证后沿原计划继续不重复创建', async () => {
  const f = await emptyLibrary(), p = await core.makePlan(f.home, 'test', f.spec, f.lark);
  const create = f.lark.create.bind(f.lark); let fail = true;
  f.lark.create = async (...args) => { const r = await create(...args); if (fail) { fail = false; throw new Error('timeout'); } return r; };
  await assert.rejects(core.applyPlan(f.home, 'test', p.plan, p.digest, f.lark), e => e.code === 'WRITE_UNCERTAIN');
  assert.equal(f.lark.writes, 1);
  await assert.rejects(core.applyPlan(f.home, 'test', p.plan, p.digest, f.lark), e => e.code === 'UNKNOWN_WRITE');
  await core.recoverPlan(f.home, 'test', p.plan, 1, wiki('Created1'), f.lark);
  await core.applyPlan(f.home, 'test', p.plan, p.digest, f.lark); assert.equal(f.lark.writes, 2);
});

test('REQ-015 子笔记响应丢失可诊断恢复；分类被改名时不继续写入', async () => {
  const f = await emptyLibrary(), p = await core.makePlan(f.home, 'test', f.spec, f.lark);
  const create = f.lark.create.bind(f.lark);
  f.lark.create = async (...args) => { const r = await create(...args); if (f.lark.writes === 2) throw new Error('timeout'); return r; };
  await assert.rejects(core.applyPlan(f.home, 'test', p.plan, p.digest, f.lark));
  assert.equal((await core.diagnosePlan(f.home, 'test', p.plan, 2, wiki('Created2'), f.lark)).verified, true);
  assert.equal((await core.recoverPlan(f.home, 'test', p.plan, 2, wiki('Created2'), f.lark)).state, 'complete');
  assert.equal(f.lark.writes, 2);
  const g = await emptyLibrary(), q = await core.makePlan(g.home, 'test', g.spec, g.lark);
  const createG = g.lark.create.bind(g.lark);
  g.lark.create = async (...args) => { const r = await createG(...args); g.lark.docs.get('Created1').title = '用户改名'; return r; };
  await assert.rejects(core.applyPlan(g.home, 'test', q.plan, q.digest, g.lark)); assert.equal(g.lark.writes, 1);
});

test('REQ-015 来源变化、重复分类与父路径变化在创建前阻断；已有分类可复用', async () => {
  const f = await emptyLibrary(), p = await core.makePlan(f.home, 'test', f.spec, f.lark);
  await core.sourceContent(f.home, 'test', f.source.id, { markdown: '已经变化的正文', coverage: 'full_text', sourceNote: '合成更新' });
  await assert.rejects(core.applyPlan(f.home, 'test', p.plan, p.digest, f.lark), e => e.code === 'SOURCE_CHANGED'); assert.equal(f.lark.writes, 0);
  const g = await emptyLibrary(), q = await core.makePlan(g.home, 'test', g.spec, g.lark);
  g.lark.add('Manual', 'ＡＩ与效率', 'Root');
  await assert.rejects(core.applyPlan(g.home, 'test', q.plan, q.digest, g.lark), e => e.code === 'DUPLICATE_TITLE'); assert.equal(g.lark.writes, 0);
  g.spec.actions = [{ ...g.spec.actions[1], parent: wiki('Manual') }]; delete g.spec.actions[0].parentStep;
  const reused = await core.makePlan(g.home, 'test', g.spec, g.lark);
  await core.applyPlan(g.home, 'test', reused.plan, reused.digest, g.lark); assert.equal(g.lark.writes, 1);
  const h = await fixture();
  const plan = await core.makePlan(h.home, 'test', { actions: [{ kind: 'create', category: 'shelf', parent: wiki('Sources'), title: '新二层', content: '说明' }] }, h.lark);
  h.lark.docs.get('Sources').title = '已改名';
  await assert.rejects(core.applyPlan(h.home, 'test', plan.plan, plan.digest, h.lark), e => e.code === 'CLASSIFICATION_CHANGED'); assert.equal(h.lark.writes, 0);
});

test('REQ-015 仅链接首次建收件箱仍为待整理；分类父路径超深或目录不完整拒绝', async () => {
  const f = await fixture({ linkOnly: true });
  for (const id of [...f.lark.docs.keys()]) if (id !== 'Root') f.lark.docs.delete(id);
  const state = await loadLibrary(f.home, 'test'); state.documents = [f.source]; await saveLibrary(f.home, state);
  f.spec.actions = [{ kind: 'create', category: 'shelf', title: '收件箱与来源', content: '等待补全正文的来源。' }, { kind: 'create', category: 'source', parentStep: 1, title: '待获取资料', content: '仅有链接，尚未读取正文。', classification: { sourceId: f.source.id, sourceHash: f.source.hash, status: 'pending', basis: 'insufficient', reason: '仅有链接', tags: [], relatedTopics: [] } }];
  const p = await core.makePlan(f.home, 'test', f.spec, f.lark); await core.applyPlan(f.home, 'test', p.plan, p.digest, f.lark);
  assert.equal((await loadLibrary(f.home, 'test')).documents.find(d => d.id === 'Created2').classification.status, 'pending');
  const g = await emptyLibrary(); g.lark.children = async () => ({ items: [], has_more: true });
  await assert.rejects(core.makePlan(g.home, 'test', g.spec, g.lark), e => e.code === 'PAGINATION'); assert.equal(g.lark.writes, 0);
});

test('REQ-015 已核实父分类被编辑或移动后，原计划不能继续写子文档', async () => {
  for (const modify of [d => { d.markdown += '\n用户修改'; }, d => { d.parent = 'Elsewhere'; }, d => { d.title = '新名称'; }]) {
    const f = await emptyLibrary(), p = await core.makePlan(f.home, 'test', f.spec, f.lark);
    const create = f.lark.create.bind(f.lark);
    f.lark.create = async (...args) => { const r = await create(...args); if (f.lark.writes === 1) f.lark.add('Conflict', '来源笔记：首次整理', 'Root'); return r; };
    await assert.rejects(core.applyPlan(f.home, 'test', p.plan, p.digest, f.lark), e => e.code === 'DUPLICATE_TITLE');
    assert.equal(f.lark.writes, 1);
    f.lark.add('Elsewhere', '其他目录', 'Root'); modify(f.lark.docs.get('Created1'));
    f.lark.docs.get('Conflict').title = '冲突已解除';
    await assert.rejects(core.applyPlan(f.home, 'test', p.plan, p.digest, f.lark), e => ['PARENT_CHANGED', 'PARENT_MISMATCH'].includes(e.code));
    assert.equal(f.lark.writes, 1);
  }
});

test('分类上下文只读列出两层位置和主题候选，不把候选当语义结论', async () => {
  const f = await fixture(), file = path.join(libraryPath(f.home, 'test'), 'library.json'), before = await fs.readFile(file, 'utf8');
  const context = await core.classificationContext(f.home, 'test', f.source.id, { queries: ['上下文 按需读取'], supplied: f.lark });
  assert.equal(context.source.hash, f.source.hash); assert.equal(context.source.coverage, 'full_text');
  assert.equal(context.locations.complete, true); assert.deepEqual(context.locations.items.find(d => d.url === wiki('AI')).path.map(p => p.title), ['收件箱与来源', 'AI与Agent']);
  assert.equal(context.topicCandidates.results[0].id, 'Context'); assert.equal(context.topicCandidates.semanticEmbedding, false);
  assert.equal(await fs.readFile(file, 'utf8'), before); assert.equal(f.lark.writes, 0);
});

test('分类、标签和主题进入同一预览，回读后持久化且能查询／画引用边', async () => {
  const f = await fixture(); f.classification.tags = [' Agent ', 'ＡＧＥＮＴ', '上下文管理'];
  const p = await core.makePlan(f.home, 'test', f.spec, f.lark);
  assert.deepEqual(p.actions[0].classification.tags, ['Agent', '上下文管理']);
  assert.deepEqual(p.actions[0].classification.destination.path.map(p => p.title), ['收件箱与来源', 'AI与Agent']);
  assert.equal(p.sources[0].hash, f.source.hash); assert.ok(p.actions[0].content.includes(wiki('Context')));
  assert.ok(p.actions[0].content.includes('标签：Agent、上下文管理')); assert.equal(f.lark.writes, 0);
  await core.applyPlan(f.home, 'test', p.plan, p.digest, f.lark);
  const state = await loadLibrary(f.home, 'test'), output = state.documents.find(d => d.id === 'Created1');
  assert.deepEqual(output.tags, ['Agent', '上下文管理']); assert.equal(output.classificationForHash, output.hash);
  assert.equal(output.recordRole, 'derived'); assert.equal(output.classification.sourceId, f.source.id);
  assert.ok(search(state.documents, ['上下文管理']).results.some(d => d.id === output.id));
  assert.ok(graphData(state.documents).edges.some(e => e.source === output.id && e.target === 'Context'));
  assert.equal(f.lark.writes, 1, '没有复制来源或顺带改写主题');
});

test('仅链接不允许内容分类，待整理和明确用户位置可用且保留覆盖边界', async () => {
  const f = await fixture({ linkOnly: true });
  await assert.rejects(core.makePlan(f.home, 'test', f.spec, f.lark), e => e.code === 'CLASSIFICATION_COVERAGE');
  Object.assign(f.classification, { status: 'pending', basis: 'insufficient', reason: '只有链接，待获取正文。', evidence: '', tags: [], relatedTopics: [] });
  f.spec.actions[0].parent = wiki('Sources');
  const pending = await core.makePlan(f.home, 'test', f.spec, f.lark);
  assert.equal(pending.actions[0].classification.status, 'pending');
  await core.applyPlan(f.home, 'test', pending.plan, pending.digest, f.lark);
  const report = await core.maintenance(f.home, 'test', { supplied: f.lark });
  assert.equal(report.pendingContentClassification.length, 1);
  const g = await fixture({ linkOnly: true });
  Object.assign(g.classification, { status: 'pending', basis: 'user', reason: '用户明确指定 AI与Agent。', tags: [], relatedTopics: [] });
  const user = await core.makePlan(g.home, 'test', g.spec, g.lark);
  assert.equal(user.actions[0].parent, wiki('AI')); assert.equal(user.actions[0].classification.coverage, 'link_only');
});

test('标签和主题数量有限，拒绝伪造依据、非主题或过期版本', async () => {
  for (const [change, code] of [
    [f => { f.classification.tags = ['a','b','c','d','e','f']; }, 'TAGS'],
    [f => { f.classification.evidence = '原文没有这句话'; }, 'CLASSIFICATION_EVIDENCE'],
    [f => { f.classification.relatedTopics[0].topicEvidence = '未出现的证据'; }, 'TOPIC_EVIDENCE'],
    [f => { f.classification.relatedTopics[0].id = 'missing'; }, 'TOPIC'],
    [f => { f.classification.sourceHash = 'old'; }, 'SOURCE_CHANGED']
  ]) { const f = await fixture(); change(f); await assert.rejects(core.makePlan(f.home, 'test', f.spec, f.lark), e => e.code === code); assert.equal(f.lark.writes, 0); }
});

test('分类位置不得越界或超过两层，新增分类只是建议', async () => {
  const f = await fixture(); f.lark.add('Deep', '更深分类', 'AI');
  f.spec.actions[0].parent = wiki('Deep');
  await assert.rejects(core.makePlan(f.home, 'test', f.spec, f.lark), e => e.code === 'CLASSIFICATION_DEPTH');
  f.lark.add('Outside', '其他空间', null); f.spec.actions[0].parent = wiki('Outside');
  await assert.rejects(core.makePlan(f.home, 'test', f.spec, f.lark), e => e.code === 'OUT_OF_SCOPE');
  f.spec.actions[0].parent = wiki('Sources'); Object.assign(f.classification, { status: 'pending', proposedCategory: { name: 'Agent工程', reason: '建议归入该主题，等待决定。' } });
  const p = await core.makePlan(f.home, 'test', f.spec, f.lark);
  assert.equal(p.actions.length, 1); assert.equal(p.actions[0].classification.proposedCategory.name, 'Agent工程');
  assert.equal(f.lark.writes, 0);
});

test('预览后来源、主题或分类路径改变均在写入前停止', async () => {
  for (const mutation of ['source', 'topic', 'path']) {
    const f = await fixture(); const p = await core.makePlan(f.home, 'test', f.spec, f.lark);
    if (mutation === 'source') await core.sourceContent(f.home, 'test', f.source.id, { markdown: body + '新条件', coverage: 'full_text', sourceNote: '新合成版本' });
    if (mutation === 'topic') f.lark.docs.get('Context').markdown += '新条件';
    if (mutation === 'path') f.lark.docs.get('AI').parent = 'Topics';
    await assert.rejects(core.applyPlan(f.home, 'test', p.plan, p.digest, f.lark), e => ['SOURCE_CHANGED','TOPIC_CHANGED','CLASSIFICATION_CHANGED'].includes(e.code));
    assert.equal(f.lark.writes, 0);
  }
});

test('用户修改分类生成新预览，不能挪用旧摘要授权', async () => {
  const f = await fixture(); const first = await core.makePlan(f.home, 'test', f.spec, f.lark);
  f.spec.actions[0].parent = wiki('Sources'); f.classification.basis = 'user'; f.classification.reason = '用户要求放到来源根。';
  const second = await core.makePlan(f.home, 'test', f.spec, f.lark);
  await core.retirePlan(f.home, 'test', first.plan, { approval: first.digest, reason: '用户修改位置', replacement: second.plan });
  await assert.rejects(core.applyPlan(f.home, 'test', second.plan, first.digest, f.lark), e => e.code === 'PLAN_APPROVAL');
  await core.applyPlan(f.home, 'test', second.plan, second.digest, f.lark);
  assert.equal(f.lark.docs.get('Created1').parent, 'Sources'); assert.equal(f.lark.writes, 1);
});

test('不完整目录不能宣称需要新分类，同名建议和重复游标被阻止', async () => {
  const f = await fixture();
  const partial = await core.classificationContext(f.home, 'test', f.source.id, { limit: 1, supplied: f.lark });
  assert.equal(partial.locations.complete, false); assert.equal(partial.locations.items.length, 1);
  Object.assign(f.classification, { status: 'pending', proposedCategory: { name: 'AI与Agent', reason: '已有同名位置' } });
  f.spec.actions[0].parent = wiki('Sources');
  await assert.rejects(core.makePlan(f.home, 'test', f.spec, f.lark), e => e.code === 'CLASSIFICATION_EXISTS');
  f.lark.children = async () => ({ items: [], has_more: true, page_token: 'repeat' });
  await assert.rejects(core.classificationContext(f.home, 'test', f.source.id, { supplied: f.lark }), e => e.code === 'PAGINATION');
});

test('同一来源不复制成多篇，不能在分类计划中顺带改关联主题', async () => {
  const f = await fixture();
  const duplicate = structuredClone(f.spec.actions[0]); duplicate.title += '副本';
  await assert.rejects(core.makePlan(f.home, 'test', { actions: [f.spec.actions[0], duplicate] }, f.lark), e => e.code === 'CLASSIFICATION_DUPLICATE');
  await assert.rejects(core.makePlan(f.home, 'test', { actions: [f.spec.actions[0], { kind: 'append', category: 'topic', doc: wiki('Context'), content: '新内容' }] }, f.lark), e => e.code === 'CLASSIFICATION_TOPIC_WRITE');
  const p = await core.makePlan(f.home, 'test', f.spec, f.lark); await core.applyPlan(f.home, 'test', p.plan, p.digest, f.lark);
  f.spec.actions[0].title = '另一篇同来源笔记';
  await assert.rejects(core.makePlan(f.home, 'test', f.spec, f.lark), e => e.code === 'SOURCE_ALREADY_FILED');
  assert.equal(f.lark.writes, 1);
});

test('分类说明按文本写入，旧标签复用且空白标签忽略', async () => {
  const f = await fixture(), state = await loadLibrary(f.home, 'test');
  state.documents[1].tags = ['Agent']; state.documents[1].classificationForHash = state.documents[1].hash;
  await saveLibrary(f.home, state);
  f.classification.tags = ['agent', '  ', 'C#']; f.classification.reason = '<script>不是命令</script> [文字](javascript:alert(1))';
  const p = await core.makePlan(f.home, 'test', f.spec, f.lark);
  assert.deepEqual(p.actions[0].classification.tags, ['Agent', 'C#']); assert.ok(p.actions[0].content.includes('标签：Agent、C#')); assert.ok(!p.actions[0].content.includes('<script>'));
  assert.ok(!p.actions[0].content.includes('[文字](javascript:'));
  await core.applyPlan(f.home, 'test', p.plan, p.digest, f.lark);
  assert.equal(f.lark.writes, 1);
});

test('不同预览竞争同一来源时，先完成的一篇会阻止后续副本', async () => {
  const f = await fixture(); const first = await core.makePlan(f.home, 'test', f.spec, f.lark);
  f.spec.actions[0].title += '另一版本'; const second = await core.makePlan(f.home, 'test', f.spec, f.lark);
  await core.applyPlan(f.home, 'test', first.plan, first.digest, f.lark);
  await assert.rejects(core.applyPlan(f.home, 'test', second.plan, second.digest, f.lark), e => e.code === 'SOURCE_ALREADY_FILED');
  assert.equal(f.lark.writes, 1);
});

test('目录超出有界扫描时不提出新分类，主题数和动作类型受限', async () => {
  const f = await fixture();
  f.classification.relatedTopics = Array(4).fill(f.classification.relatedTopics[0]);
  await assert.rejects(core.makePlan(f.home, 'test', f.spec, f.lark), e => e.code === 'TOPIC');
  f.classification.relatedTopics = []; f.spec.actions[0].kind = 'append'; f.spec.actions[0].doc = wiki('Context');
  await assert.rejects(core.makePlan(f.home, 'test', f.spec, f.lark), e => e.code === 'CLASSIFICATION_ACTION');
  f.spec.actions[0].kind = 'create'; f.spec.actions[0].parent = wiki('Sources');
  Object.assign(f.classification, { status: 'pending', proposedCategory: { name: '拟建新分类', reason: '测试目录未读完' } });
  for (let i = 0; i < 1001; i++) f.lark.add('Folder' + i, '子分类' + i, 'Sources');
  await assert.rejects(core.makePlan(f.home, 'test', f.spec, f.lark), e => e.code === 'CLASSIFICATION_CATALOG');
  assert.equal(f.lark.writes, 0);
});
