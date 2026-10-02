import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { hash, canonicalSource, loadLibrary, saveLibrary, libraryPath, readJSON, writeJSON, locked, issue } from '../skills/elx-magic-study/scripts/store.mjs';
import { Lark, feishuURL } from '../skills/elx-magic-study/scripts/lark.mjs';
import { tokenize, search, graphData, lint } from '../skills/elx-magic-study/scripts/retrieval.mjs';
import { graphHTML, exportGraph } from '../skills/elx-magic-study/scripts/graph.mjs';
import { bind, capture, sourceContent, makePlan, applyPlan, recoverPlan, sync, maintenance, schedulePrompt } from '../skills/elx-magic-study/scripts/library-core.mjs';
import { run } from '../skills/elx-magic-study/scripts/library.mjs';

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../artifacts/test-runs', randomUUID());
const root = 'https://example.feishu.cn/wiki/ROOT12345678901234567890';
function home() { return path.join(base, randomUUID()); }
class FakeLark {
  constructor() { this.account = 'test-account'; this.docs = new Map(); this.writes = 0; this.result = 'success'; this.nodePages = []; this.throwAfterCreate = false; this.rootSpace = '1'; }
  async identity() { return { account: this.account, available: true, status: 'valid' }; }
  async assertAccount(state) { if (state.account !== this.account) throw issue('ACCOUNT_CHANGED', 'account changed'); }
  async node(url) { if (url === root) return { node_token: 'ROOT12345678901234567890', space_id: this.rootSpace, title: '测试根', obj_type: 'folder' }; const d = [...this.docs.values()].find(d => d.url === url); if (!d) throw issue('UNKNOWN', 'unknown'); return { node_token: 'n' + d.id, parent_node_token: d.parent || 'ROOT12345678901234567890', space_id: '1', obj_token: d.id, obj_type: 'docx', title: d.title }; }
  async inScope(url) { if (url !== root && ![...this.docs.values()].some(d => d.url === url)) throw issue('OUT_OF_SCOPE', 'out of scope'); return { allowed: true }; }
  async fetch(url) { const d = [...this.docs.values()].find(d => d.url === url || d.id === url); if (!d || d.fail) throw issue('FETCH', 'not readable'); return structuredClone(d); }
  async children() { return { items: this.nodePages, has_more: false }; }
  add(id, markdown, title = id) { const d = { id, markdown, title, url: `https://example.feishu.cn/docx/${id}`, revision: 1 }; this.docs.set(id, d); return d; }
  async create(parent, title, markdown) { this.writes++; const d = this.add('created' + this.writes, markdown, title); d.parent = parent; if (this.throwAfterCreate) throw issue('TIMEOUT', 'unknown result'); return { ok: true, data: { document: { document_id: d.id, url: d.url }, result: this.result, warnings: [] } }; }
  async update(url, a) { this.writes++; const d = [...this.docs.values()].find(d => d.url === url); d.markdown = a.kind === 'append' ? d.markdown + '\n' + a.content : d.markdown.replace(a.pattern, a.content); d.revision++; return { ok: true, data: { document: { document_id: d.id, url: d.url }, result: this.result, warnings: [] } }; }
}
async function fixture() { const dir = home(), lark = new FakeLark(); await bind(dir, { id: 'test', readRoots: [root], writeRoot: root, confirmed: true }, lark); return { dir, lark }; }

test('规范化保留分集和时间参数，飞书 token 不截断，拒绝危险 URL', () => {
  assert.equal(canonicalSource('https://example.com/video?p=2&utm_source=x#t=7'), 'https://example.com/video?p=2#t=7');
  assert.equal(feishuURL(root).token, 'ROOT12345678901234567890');
  assert.throws(() => feishuURL('https://example.feishu.cn.evil.com/wiki/a'));
  assert.throws(() => canonicalSource('javascript:alert(1)'));
  assert.throws(() => canonicalSource('https://u:p@example.com/'));
});
test('中文 BM25 检索正确候选，附正文片段及真实引用邻居', () => {
  const docs = [{ id:'a', title:'离线授权', markdown:'# 授权\n断网时使用本地缓存许可证，联网之后再校验。[资料](https://example.com/b)', url:'https://example.com/a' }, { id:'b', title:'许可证撤销', markdown:'需要连接服务端才能同步撤销状态。', url:'https://example.com/b' }, { id:'c', title:'视频剪辑', markdown:'画面与音轨的裁切。', url:'https://example.com/c' }];
  const result = search(docs, ['断网 缓存']); assert.equal(result.results[0].id,'a'); assert.equal(result.neighbors[0].id,'b'); assert.ok(result.results[0].excerpts[0].text.includes('许可证')); assert.equal(result.semanticEmbedding,false); assert.ok(tokenize('知识图谱').length);
  assert.equal(search(docs,['完全不存在的英文词xyz']).results.length,0);
});
test('图谱只画引用边，不根据相似标题猜关系；HTML 不执行恶意标题', async () => {
  const docs = [{ id:'a',title:'主题</script><script>alert(1)</script>',url:'https://example.com/a',markdown:'[B](https://example.com/b)' },{id:'b',title:'主题B',url:'https://example.com/b',markdown:'没有指向 C 的关系'},{id:'c',title:'主题C',url:'javascript:alert(2)',markdown:''}];
  const graph=graphData(docs); assert.equal(graph.edges.length,1); assert.equal(graph.nodes[2].url,null);
  const {html}=await graphHTML(docs); assert.ok(!html.includes('主题</script>')); const embedded=JSON.parse(html.match(/type="application\/json">([\s\S]*?)<\/script>/)[1]); assert.equal(embedded.nodes[0].title,docs[0].title);
});
test('图谱限制明确报告省略且拒绝覆盖用户已有文件', async () => {
  const output=path.join(home(),'graph.html'); const docs=[{id:'a',markdown:'',title:'A'},{id:'b',markdown:'',title:'B'}]; const result=await exportGraph(docs,output,{maxNodes:1}); assert.equal(result.omitted,1); await assert.rejects(exportGraph(docs,output,{}),e=>e.code==='EEXIST');
});
test('绑定需确认，不覆盖已有绑定', async () => {
  const dir=home(),lark=new FakeLark(); await assert.rejects(bind(dir,{id:'test',readRoots:[root]},lark),e=>e.code==='CONFIRM_REQUIRED');
  await bind(dir,{id:'test',readRoots:[root],confirmed:true},lark); await assert.rejects(bind(dir,{id:'test',readRoots:[root],confirmed:true},lark),e=>e.code==='ALREADY_BOUND');
});
test('收藏重复与原始快照不可变，始终标明尚未写飞书', async () => {
  const {dir}=await fixture(); const first=await capture(dir,'test',{url:'https://example.com/a?utm_source=x',title:'文章'}); const second=await capture(dir,'test',{url:'https://example.com/a',title:'文章'}); assert.equal(second.id,first.id); assert.equal(second.existing,true); assert.equal(first.remoteSaved,false);
  const input={markdown:'原文',coverage:'full_text',sourceNote:'用户提供的全文'}; await sourceContent(dir,'test',first.id,input); const file=path.join(libraryPath(dir,'test'),'snapshots',first.id+'-'+hash('原文')+'.json'); const before=await fs.readFile(file,'utf8'); await sourceContent(dir,'test',first.id,input); assert.equal(await fs.readFile(file,'utf8'),before);
});
test('没有批准 digest 和篡改的计划均不得写远端', async () => {
  const {dir,lark}=await fixture(); const p=await makePlan(dir,'test',{actions:[{kind:'create',title:'来源A',content:'真实内容'}]},lark); await assert.rejects(applyPlan(dir,'test',p.plan,'wrong',lark),e=>e.code==='PLAN_APPROVAL');
  const f=path.join(libraryPath(dir,'test'),'operations',p.plan+'.json');const changed=await readJSON(f);changed.payload.actions[0].content='被改了';await writeJSON(f,changed);await assert.rejects(applyPlan(dir,'test',p.plan,p.digest,lark),e=>e.code==='PLAN_APPROVAL');assert.equal(lark.writes,0);
});
test('创建回读成功、重复 apply 幂等', async () => {
  const {dir,lark}=await fixture(); const p=await makePlan(dir,'test',{actions:[{kind:'create',title:'来源A',content:'正文内容'}]},lark); const result=await applyPlan(dir,'test',p.plan,p.digest,lark);assert.equal(result.state,'complete');const again=await applyPlan(dir,'test',p.plan,p.digest,lark);assert.equal(again.alreadyApplied,true);assert.equal(lark.writes,1);
});
test('尚未进入本地缓存的同名远端页面也会阻止重复创建', async () => {
  const {dir,lark}=await fixture();lark.nodePages.push({obj_type:'docx',obj_token:'old',node_token:'old',title:'已存在',has_child:false});await assert.rejects(makePlan(dir,'test',{actions:[{kind:'create',title:'已存在',content:'资料'}]},lark),e=>e.code==='DUPLICATE_TITLE');assert.equal(lark.writes,0);
});
test('创建到已授权子分类，并回读验证直接父节点', async () => {
  const {dir,lark}=await fixture();const category=lark.add('category','分类说明','收件箱与来源');const p=await makePlan(dir,'test',{actions:[{kind:'create',parent:category.url,title:'分类中的来源笔记',content:'正文'}]},lark);assert.equal(p.actions[0].parentNodeToken,'ncategory');await applyPlan(dir,'test',p.plan,p.digest,lark);assert.equal(lark.docs.get('created1').parent,'ncategory');
});
test('并发人工编辑阻止追加，原有内容保留', async () => {
  const {dir,lark}=await fixture();const d=lark.add('a','原来的内容');const p=await makePlan(dir,'test',{actions:[{kind:'append',doc:d.url,content:'新增资料'}]},lark);d.markdown+='\n用户手动新增';await assert.rejects(applyPlan(dir,'test',p.plan,p.digest,lark),e=>e.code==='CONCURRENT_EDIT');assert.equal(lark.writes,0);assert.ok(d.markdown.includes('用户手动新增'));
});
test('账号变化和写入根移动均阻止远端写入', async () => {
  const {dir,lark}=await fixture();const p=await makePlan(dir,'test',{actions:[{kind:'create',title:'来源A',content:'内容'}]},lark);lark.account='another';await assert.rejects(applyPlan(dir,'test',p.plan,p.digest,lark),e=>e.code==='ACCOUNT_CHANGED');lark.account='test-account';lark.rootSpace='2';await assert.rejects(applyPlan(dir,'test',p.plan,p.digest,lark),e=>e.code==='ROOT_CHANGED');assert.equal(lark.writes,0);
});
test('远端来源更新时不能沿用旧整理内容执行', async () => {
  const {dir,lark}=await fixture();const d=lark.add('source','原始版本');const state=await loadLibrary(dir,'test');state.documents.push({...d,hash:hash(d.markdown)});await saveLibrary(dir,state);const p=await makePlan(dir,'test',{sourceIds:['source'],actions:[{kind:'create',title:'结论',content:'旧内容的结论'}]},lark);d.markdown='新版本';await assert.rejects(applyPlan(dir,'test',p.plan,p.digest,lark),e=>e.code==='SOURCE_CHANGED');assert.equal(lark.writes,0);
});
test('创建成功但响应丢失，recover 只查证、不重复创建', async () => {
  const {dir,lark}=await fixture();const p=await makePlan(dir,'test',{actions:[{kind:'create',title:'来源A',content:'原始依据'}]},lark);lark.throwAfterCreate=true;await assert.rejects(applyPlan(dir,'test',p.plan,p.digest,lark),e=>e.code==='WRITE_UNCERTAIN');await assert.rejects(applyPlan(dir,'test',p.plan,p.digest,lark),e=>e.code==='UNKNOWN_WRITE');const result=await recoverPlan(dir,'test',p.plan,1,lark.docs.get('created1').url,lark);assert.equal(result.state,'complete');assert.equal(lark.writes,1);
});
test('partial_success 不视为完整成功，恢复不会静默忽略', async () => {
  const {dir,lark}=await fixture();const p=await makePlan(dir,'test',{actions:[{kind:'create',title:'来源A',content:'内容'}]},lark);lark.result='partial_success';await assert.rejects(applyPlan(dir,'test',p.plan,p.digest,lark),e=>e.code==='WRITE_UNCERTAIN');await assert.rejects(recoverPlan(dir,'test',p.plan,1,lark.docs.get('created1').url,lark),e=>e.code==='WRITE_WARNING');assert.equal(lark.writes,1);
});
test('唯一行内替换允许新文本包含旧词，其他正文完全保留', async () => {
  const {dir,lark}=await fixture();const d=lark.add('a','# 方法\n使用缓存。\n用户自己的备注。');const p=await makePlan(dir,'test',{actions:[{kind:'str_replace',doc:d.url,pattern:'缓存',content:'缓存策略'}]},lark);await applyPlan(dir,'test',p.plan,p.digest,lark);assert.equal(d.markdown,'# 方法\n使用缓存策略。\n用户自己的备注。');
});
test('拒绝不明确替换、自动资源下载和越界目标', async () => {
  const {dir,lark}=await fixture();const d=lark.add('a','重复重复');await assert.rejects(makePlan(dir,'test',{actions:[{kind:'str_replace',doc:d.url,pattern:'重复',content:'替换'}]},lark),e=>e.code==='PATTERN_AMBIGUOUS');await assert.rejects(makePlan(dir,'test',{actions:[{kind:'create',title:'图片',content:'![图片](https://example.com/a.png)'}]},lark),e=>e.code==='ACTIVE_RESOURCE');await assert.rejects(makePlan(dir,'test',{actions:[{kind:'append',doc:'https://example.feishu.cn/docx/elsewhere',content:'不该写'}]},lark),e=>e.code==='OUT_OF_SCOPE');
});
test('实际 Lark 适配器验证 Wiki 祖先，拒绝跨空间同名节点', async () => {
  const lark=new Lark(null,async args=>{const value=args[args.indexOf('--node-token')+1];return {data:{node:value.includes('/docx/')?{node_token:'child',parent_node_token:'root',space_id:'2'}:{node_token:'root',space_id:'2'}}};});await assert.rejects(lark.inScope('https://example.feishu.cn/docx/doc',[{kind:'wiki',node_token:'root',space_id:'1',url:root}]),e=>e.code==='OUT_OF_SCOPE');
});
test('兼容官方 node-get 顶层对象与 node-list 的 data.nodes 契约', async () => {
  const lark=new Lark(null,async args=>args.includes('+node-get')?{space_id:'1',node_token:'ROOT',obj_token:'DOC',obj_type:'docx'}:{ok:true,data:{nodes:[{node_token:'CHILD',obj_token:'CHILDDOC',obj_type:'docx'}],has_more:true,page_token:'cursor'}});
  assert.equal((await lark.node(root)).node_token,'ROOT');const page=await lark.children({space_id:'1',node_token:'ROOT'});assert.equal(page.items[0].node_token,'CHILD');assert.equal(page.page_token,'cursor');assert.equal(page.has_more,true);
});
test('只读同步轮转覆盖，不删除离开范围的缓存', async () => {
  const {dir,lark}=await fixture();for(const id of ['a','b']){lark.add(id,id+'正文');lark.nodePages.push({obj_type:'docx',obj_token:id,node_token:id,title:id,has_child:false});}
  const originalFetch=lark.fetch.bind(lark);lark.fetch=async url=>originalFetch(url.replace('/wiki/','/docx/'));
  await sync(dir,'test',{maxDocs:1,supplied:lark});let state=await loadLibrary(dir,'test');assert.equal(state.documents.length,1);await sync(dir,'test',{maxDocs:1,supplied:lark});state=await loadLibrary(dir,'test');assert.equal(state.documents.length,2);lark.nodePages=[];await sync(dir,'test',{supplied:lark});state=await loadLibrary(dir,'test');assert.equal(state.documents.length,2);assert.ok(state.documents.every(d=>d.outOfScope));assert.equal(lark.writes,0);
});
test('定时入口无变化静默，并且只做本地检查不写飞书', async () => {
  const {dir,lark}=await fixture();await capture(dir,'test',{url:'https://example.com/a',title:'待整理'});const first=await maintenance(dir,'test');const second=await maintenance(dir,'test');assert.equal(first.notify,true);assert.equal(second.changed,false);assert.equal(second.notify,false);assert.equal(lark.writes,0);assert.equal(first.mode,'draft-and-check-only');
  const state=await loadLibrary(dir,'test');const prompt=schedulePrompt(state,'D:/skill',dir);assert.ok(prompt.includes('不运行 apply'));assert.ok(prompt.includes('没有变化'));assert.ok(prompt.includes('test'));
});
test('检查报告不把缓存缺失引用认定为断链或删页依据', () => {const r=lint([{id:'a',title:'A',markdown:'[资料](https://example.feishu.cn/docx/missing)',coverage:'full_text'}]);assert.equal(r.mode,'local-cache-read-only');assert.ok(r.issues.some(i=>i.type==='unresolved-link'&&i.message.includes('不等于')));});
test('相同状态目录的并发写被阻断，结束后锁自动释放', async () => {const dir=home();await locked(dir,async()=>{await assert.rejects(locked(dir,async()=>{}),e=>e.code==='BUSY')});await locked(dir,async()=>{});});
test('CLI 无绑定时进入引导，不误称已注册计划', async () => {await assert.rejects(run(['status','--home',home()]),e=>e.code==='ONBOARDING_REQUIRED');const {dir}=await fixture();const output=path.join(dir,'schedule.json');const result=await run(['schedule-plan','--home',dir,'--library','test','--time','09:00','--timezone','Asia/Shanghai','--output',output]);assert.equal(result.state,'proposal-not-registered');assert.deepEqual((await loadLibrary(dir,'test')).schedules,[]);});

test('OPT-01 输入整理为来源笔记后不重复入队，输入更新仅产生一个待办', async () => {
  const {dir,lark}=await fixture();const src=await capture(dir,'test',{url:'https://example.com/input',title:'原始资料'});
  await sourceContent(dir,'test',src.id,{markdown:'原始资料第一版',coverage:'full_text',sourceNote:'合成材料'});
  const p=await makePlan(dir,'test',{sourceIds:[src.id],actions:[{kind:'create',title:'整理后的来源笔记',category:'source',content:'这是一份综合笔记'}]},lark);
  await applyPlan(dir,'test',p.plan,p.digest,lark);
  assert.deepEqual((await maintenance(dir,'test')).pending,[]);
  assert.equal((await maintenance(dir,'test')).notify,false);
  await sourceContent(dir,'test',src.id,{markdown:'原始资料第二版',coverage:'full_text',sourceNote:'合成材料更新'});
  assert.deepEqual((await maintenance(dir,'test')).pending.map(d=>d.id),[src.id]);
});
test('OPT-01 旧版角色不明的远端记录列为待分类，不静默处理或丢失', async () => {
  const {dir}=await fixture();const s=await loadLibrary(dir,'test');s.documents.push({id:'legacy',title:'来源笔记',kind:'source',remote:true,markdown:'旧版正文',hash:hash('旧版正文')});await saveLibrary(dir,s);
  const result=await maintenance(dir,'test');assert.deepEqual(result.pending,[]);assert.deepEqual(result.needsClassification.map(d=>d.id),['legacy']);
  assert.equal((await loadLibrary(dir,'test')).documents[0].recordRole,undefined);
});
test('OPT-01 单条角色分类需要确认，分类后输入正常入队且正文保持', async () => {
  const {dir}=await fixture();const s=await loadLibrary(dir,'test');s.documents.push({id:'legacy',markdown:'保留正文',hash:hash('保留正文'),remote:true});await saveLibrary(dir,s);
  await assert.rejects(run(['classify','--home',dir,'--library','test','--id','legacy','--role','input']),e=>e.code==='CONFIRM_REQUIRED');
  await run(['classify','--home',dir,'--library','test','--id','legacy','--role','input','--confirm']);assert.equal((await maintenance(dir,'test')).pending[0].id,'legacy');assert.equal((await loadLibrary(dir,'test')).documents[0].markdown,'保留正文');
});
