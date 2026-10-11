import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { hash, writeJSON, saveLibrary, loadLibrary } from '../skills/elx-magic-study/scripts/store.mjs';
import * as core from '../skills/elx-magic-study/scripts/library-core.mjs';
import {Lark} from '../skills/elx-magic-study/scripts/lark.mjs';

const root='https://example.feishu.cn/wiki/Root';
const preferences='| 偏好项目 | 用户填写 | 默认说明 |\n|---|---|---|\n| 展示风格 | | 默认 |\n| 标题细节 | | 默认 |';
async function module() { return import('../skills/elx-magic-study/scripts/workbench.mjs'); }
class FakeManager {
  constructor(){this.account='test';this.docs=new Map();this.records=new Map();this.writes=0;this.fail=false;this.baseWrites=0;
    for(const [id,title,md] of [['Root','书屋','首页'],['Main','书屋工作台','## 书屋数据（自动更新）\n\n暂无数据\n\nELX工作台自动区域结束\n\n## 我的备注\n保留我的意见'],['Prefs','个人整理偏好',preferences],['Topics','主题更新建议','## 主题建议（自动更新）\n\n暂无建议\n\nELX主题建议自动区域结束']])this.docs.set(id,{id,title,markdown:md,url:`https://example.feishu.cn/wiki/${id}`,revision:1});
  }
  async identity(){return {account:this.account};}
  async assertAccount(s){assert.equal(s.account,this.account);}
  async node(url){const id=url.split('/').at(-1),d=this.docs.get(id);return {node_token:id,obj_token:id==='Base'?'BASE':id,space_id:'1',parent_node_token:id==='Root'?null:'Root',title:d?.title||'多维表格',obj_type:id==='Base'?'bitable':'docx'};}
  async inScope(){return {allowed:true};}
  async fetch(url){return structuredClone(this.docs.get(url.split('/').at(-1)));}
  async children(){return {items:[],has_more:false};}
  async create(parent,title,markdown){const id='Created'+(++this.writes);const d={id,title,markdown,url:`https://example.feishu.cn/wiki/${id}`,revision:1};this.docs.set(id,d);return {data:{document:{document_id:id,url:d.url},result:'success'}};}
  async workbenchRows(){return [...this.records.values()].map(r=>structuredClone(r));}
  async workbenchUpsert(config,recordId,fields){if(this.fail)throw new Error('manager unavailable');this.baseWrites++;const id=recordId||'rec'+(this.records.size+1),existing=this.records.get(id);this.records.set(id,{recordId:id,fields:{...existing?.fields,...fields}});return id;}
  async workbenchRegion(url,heading,end){const d=await this.fetch(url);const a=d.markdown.indexOf('## '+heading),b=d.markdown.indexOf(end,a);return {document:d,text:d.markdown.slice(a,b+end.length),startId:'start',endId:'end'};}
  async workbenchWrite(url,region,content){if(this.fail)throw new Error('manager unavailable');const d=this.docs.get(url.split('/').at(-1));d.markdown=d.markdown.replace(region.text,content);d.revision++;return {data:{result:'success',warnings:[]}};}
}
async function fixture(){const home=path.resolve('artifacts/test-runs/workbench',randomUUID()),lark=new FakeManager();await core.bind(home,{id:'test',readRoots:[root],writeRoot:root,confirmed:true},lark);const wb=await module();await wb.bindWorkbench(home,'test',{confirmed:true,pages:{main:lark.docs.get('Main').url,preferences:lark.docs.get('Prefs').url,suggestions:lark.docs.get('Topics').url},base:{token:'BASE',tableId:'tbl1',wikiURL:'https://example.feishu.cn/wiki/Base',url:'https://example.feishu.cn/base/BASE'}},lark);return {home,lark,wb};}

test('REQ-019 偏好读取、变化提示与预览版本约束，不自动迁移旧文档',async()=>{
  const f=await fixture();let c=await f.wb.workbenchContext(f.home,'test',f.lark);assert.deepEqual(c.preferences.values,{});assert.equal(c.preferences.changed,false);
  f.lark.docs.get('Prefs').markdown=preferences.replace('| 展示风格 | |','| 展示风格 | 优先表格 |');c=await f.wb.workbenchContext(f.home,'test',f.lark);assert.equal(c.preferences.values['展示风格'],'优先表格');assert.equal(c.preferences.changed,true);
  await f.wb.acknowledgePreferences(f.home,'test',{hash:c.preferences.hash,choice:'later'},f.lark);assert.equal((await f.wb.workbenchContext(f.home,'test',f.lark)).preferences.changed,false);
  const p=await core.makePlan(f.home,'test',{actions:[{kind:'create',title:'正常文章',content:'正文'}]},f.lark);f.lark.docs.get('Prefs').markdown=f.lark.docs.get('Prefs').markdown.replace('优先表格','简短段落');
  await assert.rejects(core.applyPlan(f.home,'test',p.plan,p.digest,f.lark),e=>e.code==='PREFERENCES_CHANGED');assert.equal(f.lark.writes,0);
});

test('REQ-019 自动同步、幂等与备注保护；管理失败不污染文章成功',async()=>{
  const f=await fixture(),p=await core.makePlan(f.home,'test',{actions:[{kind:'create',title:'测试文章',content:'有来源的正文'}]},f.lark);
  assert.ok(f.lark.records.size);const first=[...f.lark.records.values()][0];first.fields['我的备注／调整意见']='用户意见';
  f.lark.fail=true;const r=await core.applyPlan(f.home,'test',p.plan,p.digest,f.lark);assert.equal(r.state,'complete');assert.equal(r.workbench.status,'pending');assert.equal(f.lark.writes,1);
  f.lark.fail=false;await f.wb.syncWorkbench(f.home,'test',f.lark);const count=f.lark.records.size;await f.wb.syncWorkbench(f.home,'test',f.lark);assert.equal(f.lark.records.size,count);assert.equal(f.lark.writes,1);assert.ok([...f.lark.records.values()].some(x=>x.fields['我的备注／调整意见']==='用户意见'));assert.ok(f.lark.docs.get('Main').markdown.includes('保留我的意见'));
  const s=await loadLibrary(f.home,'test');assert.equal(f.wb.knowledgeDocuments(s).some(d=>d.id==='Main'),false);
});

test('REQ-019 主题建议有双方证据及版本，记录建议不直接修改主题正文',async()=>{
  const f=await fixture(),s=await loadLibrary(f.home,'test');const source={id:'Input',title:'资料',markdown:'方法应保留适用条件。',hash:hash('方法应保留适用条件。'),remote:false,recordRole:'input',kind:'source',coverage:'full_text'},topic={id:'Topic',title:'主题',markdown:'当前方法适用于本地环境。',hash:hash('当前方法适用于本地环境。'),url:'https://example.feishu.cn/wiki/Topic',kind:'topic',remote:true};f.lark.docs.set('Topic',{...topic,revision:1});s.documents.push(source,topic);await saveLibrary(f.home,s);
  const spec={sourceId:'Input',sourceHash:source.hash,topics:[{id:'Topic',hash:topic.hash,kind:'补充',reason:'补充条件',sourceEvidence:'保留适用条件',topicEvidence:'本地环境',proposedText:'建议保留方法适用条件。'}]};
  await f.wb.recordTopicSuggestions(f.home,'test',spec,f.lark);assert.equal(f.lark.docs.get('Topic').markdown,topic.markdown);assert.ok(f.lark.docs.get('Topics').markdown.includes('建议保留方法适用条件'));
  spec.topics[0].sourceEvidence='不存在的证据';await assert.rejects(f.wb.recordTopicSuggestions(f.home,'test',spec,f.lark),e=>e.code==='SUGGESTION_EVIDENCE');
});

test('REQ-019 偏好只取填写列，格式变化不产生重复提醒，重复字段拒绝',async()=>{
  const wb=await module();assert.deepEqual(wb.parsePreferences(preferences),{});
  assert.deepEqual(wb.parsePreferences(preferences.replace(/---/g,'-')),{});
  assert.throws(()=>wb.parsePreferences('只有用户填写文字'),e=>e.code==='PREFERENCES_FORMAT');
  assert.throws(()=>wb.parsePreferences(preferences+'\n| 展示风格 | 表格 | 默认 |'),e=>e.code==='PREFERENCES_FORMAT');
});

test('REQ-019 管理区域并发编辑保留；账号或Base越界时停止写入',async()=>{
  const f=await fixture();f.lark.docs.get('Main').markdown=f.lark.docs.get('Main').markdown.replace('暂无数据','用户在自动区新增的内容');
  let r=await f.wb.syncWorkbench(f.home,'test',f.lark);assert.equal(r.code,'WORKBENCH_CONFLICT');assert.ok(f.lark.docs.get('Main').markdown.includes('用户在自动区新增的内容'));
  f.lark.account='other';r=await f.wb.syncWorkbench(f.home,'test',f.lark);assert.equal(r.status,'pending');assert.equal(f.lark.writes,0);
  f.lark.account='test';f.lark.inScope=async()=>{throw Object.assign(new Error('outside'),{code:'OUT_OF_SCOPE'});};r=await f.wb.syncWorkbench(f.home,'test',f.lark);assert.equal(r.code,'OUT_OF_SCOPE');assert.equal(f.lark.baseWrites,0);
});

test('REQ-019 Base创建响应丢失时先查证，不能生成重复记录',async()=>{
  const f=await fixture();let sent=0;const real=f.lark.workbenchUpsert.bind(f.lark);f.lark.workbenchUpsert=async(...args)=>{sent++;await real(...args);throw new Error('response lost');};
  const p=await core.makePlan(f.home,'test',{actions:[{kind:'create',title:'预览文章',content:'正文'}]},f.lark);assert.equal(p.workbench.status,'pending');assert.equal(sent,1);
  f.lark.workbenchUpsert=real;assert.equal((await f.wb.syncWorkbench(f.home,'test',f.lark)).status,'complete');assert.equal(f.lark.records.size,1);
  f.lark.workbenchUpsert=async()=>{sent++;throw new Error('unknown transport');};const q=await core.makePlan(f.home,'test',{actions:[{kind:'create',title:'第二份预览',content:'另一个正文'}]},f.lark);assert.equal(q.workbench.status,'pending');const count=sent;
  assert.equal((await f.wb.syncWorkbench(f.home,'test',f.lark)).code,'WORKBENCH_UNCERTAIN');assert.equal(sent,count);assert.equal(f.lark.records.size,1);
  assert.equal(f.lark.writes,0);
});

test('REQ-019 链接待补材料转预览后保留历史备注，工作台不进入维护队列',async()=>{
  const f=await fixture(),source=await core.capture(f.home,'test',{url:'https://example.com/article',title:'待补正文'},f.lark);
  let row=[...f.lark.records.values()].find(r=>r.fields['记录键'].startsWith('input:'));assert.deepEqual(row.fields['状态'],['待补材料']);row.fields['我的备注／调整意见']='保留人工备注';
  await core.sourceContent(f.home,'test',source.id,{markdown:'已经读到正文。',coverage:'full_text',sourceNote:'用户提供'},f.lark);
  await core.makePlan(f.home,'test',{sourceIds:[source.id],actions:[{kind:'create',title:'具体预览',content:'已整理正文'}]},f.lark);
  row=[...f.lark.records.values()].find(r=>r.fields['记录键'].startsWith('input:'));assert.deepEqual(row.fields['状态'],['暂缓']);assert.equal(row.fields['我的备注／调整意见'],'保留人工备注');
  const m=await core.maintenance(f.home,'test',{supplied:f.lark});assert.equal(m.needsClassification.some(x=>['Main','Prefs','Topics'].includes(x.id)),false);
});

test('REQ-019 官方矩阵分页及等价链接/时区回读，不把漏页当空表',async()=>{
  let calls=0;const l=new Lark(null,args=>{calls++;if(args.includes('+record-list'))return {data:{fields:['记录键','来源链接','最近更新','条目名称','状态','我的备注／调整意见'],record_id_list:['rec'+calls],data:[['key'+calls,'[https://example.com/a](https://example.com/a)','2026-10-12T01:00:00+08:00','条目',['待确认'],'']],has_more:calls===1}};return {data:{record_id_list:['new']}};});
  const rows=await l.workbenchRows({token:'BASE',tableId:'tbl1'});assert.equal(rows.length,2);assert.equal(rows[0].fields['来源链接'],'https://example.com/a');assert.equal(rows[0].fields['最近更新'],'2026-10-11T17:00:00.000Z');
  assert.equal(await l.workbenchUpsert({token:'BASE',tableId:'tbl1'},undefined,{'记录键':'new'}),'new');
  const broken=new Lark(null,()=>({data:{fields:['记录键','条目名称','状态','我的备注／调整意见'],data:[],record_id_list:[],has_more:true}}));await assert.rejects(broken.workbenchRows({token:'BASE',tableId:'tbl1'}),e=>e.code==='BASE_PAGINATION');
  const wrongTable=new Lark(null,()=>({data:{fields:['标题'],data:[],record_id_list:[],has_more:false}}));await assert.rejects(wrongTable.workbenchRows({token:'BASE',tableId:'tbl1'}),e=>e.code==='BASE_SCHEMA');
});

test('REQ-019 实际读取异常镜像、补正文后清除；未知文章单独列待查证',async()=>{
  const f=await fixture(),src=await core.capture(f.home,'test',{url:'https://example.com/failed',title:'读取试点'},f.lark);const s=await loadLibrary(f.home,'test'),d=s.documents.find(x=>x.id===src.id);
  await f.wb.recordSourceIssue(f.home,'test',{sourceId:src.id,hash:d.hash,status:'读取失败',reason:'目标需要本人登录',next:'完成登录后重新读取'},f.lark);assert.ok([...f.lark.records.values()].some(r=>r.fields['状态'][0]==='读取失败'));
  await core.sourceContent(f.home,'test',src.id,{markdown:'现在有正文',coverage:'full_text',sourceNote:'用户提供'},f.lark);assert.ok([...f.lark.records.values()].some(r=>r.fields['状态'][0]==='待确认'));assert.equal((await loadLibrary(f.home,'test')).documents.find(x=>x.id===src.id).ingestIssue,undefined);
  const p=await core.makePlan(f.home,'test',{sourceIds:[src.id],actions:[{kind:'create',title:'待查证文章',content:'具体正文'}]},f.lark),create=f.lark.create.bind(f.lark);f.lark.create=async(...args)=>{await create(...args);throw new Error('response lost');};
  await assert.rejects(core.applyPlan(f.home,'test',p.plan,p.digest,f.lark),e=>e.code==='WRITE_UNCERTAIN');assert.ok([...f.lark.records.values()].some(r=>r.fields['状态'][0]==='写入待查证'));await assert.rejects(core.applyPlan(f.home,'test',p.plan,p.digest,f.lark),e=>e.code==='UNKNOWN_WRITE');assert.equal(f.lark.writes,1);
});

test('REQ-019 管理页响应丢失后核对已写区域，数据变化也不会卡住或重建文章',async()=>{
  const f=await fixture(),write=f.lark.workbenchWrite.bind(f.lark);let lost=true;f.lark.workbenchWrite=async(...args)=>{const r=await write(...args);if(lost){lost=false;throw new Error('manager response lost');}return r;};
  assert.equal((await f.wb.syncWorkbench(f.home,'test',f.lark)).status,'pending');
  const r=await core.capture(f.home,'test',{url:'https://example.com/changed-after-loss',title:'新状态事件'},f.lark);assert.equal(r.workbench.status,'complete');assert.equal(f.lark.writes,0);assert.equal(f.lark.records.size,1);assert.ok(f.lark.docs.get('Main').markdown.includes('新状态事件'));
});

test('REQ-019 来源标题中的Markdown资源只作文字，不触发管理文档图片下载',async()=>{
  const f=await fixture();await core.capture(f.home,'test',{url:'https://example.com/text-only',title:'![图片](https://example.com/track.png) <img src=x>'},f.lark);
  const md=f.lark.docs.get('Main').markdown;assert.ok(md.includes('!\\[图片\\]'));assert.ok(md.includes('\\<img'));assert.equal(md.includes('![图片]('),false);
});

test('REQ-019 连管理失败状态都无法保存时，仍返回已核验文章成功',async()=>{
  const f=await fixture(),p=await core.makePlan(f.home,'test',{actions:[{kind:'create',title:'保存状态隔离',content:'正文'}]},f.lark),rename=fs.rename;
  f.lark.workbenchUpsert=async()=>{fs.rename=async()=>{throw Object.assign(new Error('file locked'),{code:'EPERM'});};throw new Error('base unavailable');};
  try{const r=await core.applyPlan(f.home,'test',p.plan,p.digest,f.lark);assert.equal(r.state,'complete');assert.equal(r.workbench.status,'pending');assert.equal(r.workbench.persistence,'failed');assert.equal(r.workbench.persistenceCode,'EPERM');assert.equal(f.lark.writes,1);}finally{fs.rename=rename;}
});
