import fs from 'node:fs/promises';
import path from 'node:path';
import { assert, hash, now, loadLibrary, saveLibrary, libraryPath, readJSON, safeLink } from './store.mjs';
import { Lark, feishuURL } from './lark.mjs';
import { verificationText } from './verification.mjs';

const HEAD = { main: ['书屋数据（自动更新）', 'ELX工作台自动区域结束'], suggestions: ['主题建议（自动更新）', 'ELX主题建议自动区域结束'] };
const KEYS = ['重点领域','分类习惯','标题细节','总结重点','展示风格','默认读取范围','偏好变化后提醒整理','补充说明'];
const live = d => !d.unavailable && !d.outOfScope;
const escape = s => String(s ?? '').replace(/[\r\n]/g,' ').replace(/[\\`*_\[\]$~<|]/g,'\\$&');
const link = (label,url,suffix='') => ({label,url,suffix});
const cell = value => {if(value&&typeof value==='object'&&'label'in value){const url=safeLink(value.url);assert(url,'WORKBENCH_LINK','管理链接不可用');return `[${escape(value.label)}](${url.replace(/\(/g,'%28').replace(/\)/g,'%29')})${escape(value.suffix)}`;}return escape(value);};
const table = (headers, rows) => [headers, headers.map(()=>'---'), ...rows].map(r=>'| '+r.map(cell).join(' | ')+' |').join('\n');
const client = (s,l) => l || new Lark(s.profile);
const regionHash = text => hash(verificationText(text.replace(/\[(https?:\/\/[^\s\]]+)\]\((https?:\/\/[^\s)]+)\)/g,(all,label,url)=>label===url?url:all)));
export function knowledgeDocuments(s) { const ids=new Set(Object.values(s.workbench?.pages || {}).map(p=>p.id));return s.documents.filter(d=>!ids.has(d.id)); }
export function parsePreferences(markdown) {
  const values={},seen=new Set(); let column=-1, keyColumn=-1,found=false;
  for(const line of markdown.split('\n')) {
    if(!line.trim().startsWith('|')) {column=-1; continue;}
    const cells=line.trim().replace(/^\||\|$/g,'').split(/(?<!\\)\|/).map(s=>s.replace(/\\\|/g,'|').normalize('NFKC').trim().replace(/\s+/g,' '));
    if(cells.includes('用户填写') && cells.includes('偏好项目')) {column=cells.indexOf('用户填写');keyColumn=cells.indexOf('偏好项目');found=true;continue;}
    if(column<0 || !KEYS.includes(cells[keyColumn]))continue;
    const key=cells[keyColumn],value=cells[column] || '';
    assert(!seen.has(key),'PREFERENCES_FORMAT','偏好项目重复，先核对用户填写表');seen.add(key);
    if(!['','留空','空白','—','-'].includes(value))values[key]=value;
  }
  assert(found,'PREFERENCES_FORMAT','未找到用户填写偏好表，不能静默使用默认值');
  return Object.fromEntries(KEYS.filter(k=>values[k]).map(k=>[k,values[k]]));
}
async function page(s,l,key) {const p=s.workbench.pages[key];await l.inScope(p.url,[s.writeRoot]);const d=await l.fetch(p.url);assert(d.id===p.id,'WORKBENCH_CHANGED','管理页面身份变化');return d;}
async function baseScope(s,l) {await l.inScope(s.workbench.base.wikiURL,[s.writeRoot]);const n=await l.node(s.workbench.base.wikiURL);assert(n.obj_type==='bitable'&&n.obj_token===s.workbench.base.token,'WORKBENCH_BASE','Base身份变化');}
export async function bindWorkbench(home,id,spec,supplied) {
  assert(spec.confirmed===true,'CONFIRM_REQUIRED','工作台及自动更新区域需用户确认');
  const s=await loadLibrary(home,id),l=client(s,supplied);await l.assertAccount(s);
  assert(!s.workbench && s.writeRoot,'WORKBENCH_BOUND','工作台已有绑定或没有写入根；不覆盖旧配置');
  const pages={};
  for(const key of ['main','preferences','suggestions']) {const url=feishuURL(spec.pages[key]).url;await l.inScope(url,[s.writeRoot]);const d=await l.fetch(url);assert(!Object.values(pages).some(p=>p.id===d.id),'WORKBENCH_PAGES','管理页必须独立');pages[key]={url,id:d.id};if(HEAD[key]) {const r=await l.workbenchRegion(url,...HEAD[key]);pages[key].regionHash=regionHash(r.text);}}
  const base={...spec.base,wikiURL:feishuURL(spec.base.wikiURL).url};await l.inScope(base.wikiURL,[s.writeRoot]);const n=await l.node(base.wikiURL);
  assert(n.obj_type==='bitable' && n.obj_token===base.token && /^tbl[A-Za-z0-9]+$/.test(base.tableId),'WORKBENCH_BASE','多维表格身份或数据表编号不符');
  const baseURL=new URL(base.url);assert(baseURL.protocol==='https:'&&!baseURL.username&&!baseURL.password&&/(^|\.)(feishu\.cn|larksuite\.com|larkoffice\.com)$/.test(baseURL.hostname)&&baseURL.pathname===`/base/${base.token}`,'WORKBENCH_BASE','Base访问链接与token不符');
  for(const url of Object.values(base.views||{})){const v=new URL(url);assert(v.origin===baseURL.origin&&v.pathname===baseURL.pathname&&v.searchParams.get('table')===base.tableId&&/^vew[A-Za-z0-9]+$/.test(v.searchParams.get('view')||''),'WORKBENCH_LINK','视图必须指向当前Base和数据表');}
  await l.workbenchRows(base);
  const values=parsePreferences((await l.fetch(pages.preferences.url)).markdown);
  s.workbench={pages,base,preferencesAckHash:hash(values),records:{},suggestions:[],boundAt:now(),sync:{status:'pending'}};
  for(const [key,p] of Object.entries(pages)) {const d=await l.fetch(p.url);let record=s.documents.find(x=>x.id===p.id);if(!record){record={id:p.id};s.documents.push(record);}Object.assign(record,d,{url:p.url,kind:'index',recordRole:'navigation',remote:true,hash:hash(d.markdown),managementRole:key,coverage:'full_text'});}
  await saveLibrary(home,s);return {bound:true,pages,base};
}
export async function workbenchContext(home,id,supplied) {
  const s=await loadLibrary(home,id);if(!s.workbench)return {configured:false};const l=client(s,supplied);await l.assertAccount(s);
  await baseScope(s,l);const d=await page(s,l,'preferences'),values=parsePreferences(d.markdown),digest=hash(values);
  return {configured:true,pages:s.workbench.pages,base:s.workbench.base,preferences:{values,hash:digest,changed:digest!==s.workbench.preferencesAckHash},notes: (await l.workbenchRows(s.workbench.base)).filter(r=>r.fields['我的备注／调整意见']).map(r=>({key:r.fields['记录键'],note:r.fields['我的备注／调整意见']})),sync:s.workbench.sync};
}
export async function acknowledgePreferences(home,id,spec,supplied) {
  assert(['later','no','preview'].includes(spec.choice),'PREFERENCES_CHOICE','只记录用户明确的稍后、不整理或先预览选择');const c=await workbenchContext(home,id,supplied);assert(c.configured&&c.preferences.hash===spec.hash,'PREFERENCES_CHANGED','偏好已经变化，请重新读取');const s=await loadLibrary(home,id);s.workbench.preferencesAckHash=spec.hash;s.workbench.preferencesDecision={choice:spec.choice,at:now()};await saveLibrary(home,s);return {recorded:true,choice:spec.choice,remoteKnowledgeChanged:false};
}
export async function recordSourceIssue(home,id,spec,supplied) {
  const s=await loadLibrary(home,id),d=knowledgeDocuments(s).find(d=>d.id===spec.sourceId&&d.remote===false);assert(d&&d.hash===spec.hash,'SOURCE_CHANGED','异常记录需引用当前本地来源版本');assert(['读取失败','待补材料','暂缓'].includes(spec.status)&&spec.reason?.trim()&&spec.reason.length<=500&&spec.next?.trim()&&spec.next.length<=500,'SOURCE_ISSUE','需要实际异常状态、有限原因与下一步，不保存凭据或原始错误');d.ingestIssue={status:spec.status,reason:spec.reason,next:spec.next,at:now()};await saveLibrary(home,s);return {recorded:true,remoteKnowledgeChanged:false,workbench:await syncWorkbench(home,id,supplied)};
}
async function plans(home,s) {let files;const dir=path.join(libraryPath(home,s.id),'operations');try{files=await fs.readdir(dir);}catch(e){if(e.code==='ENOENT')return [];throw e;}
  const found=[];for(const f of files.filter(f=>f.endsWith('.json'))){const p=await readJSON(path.join(dir,f));assert(p.payload?.library===s.id&&p.payload.account===s.account&&hash(p.payload.writeRoot)===hash(s.writeRoot),'PLAN_BINDING','旧操作身份不符，不能同步到当前工作台');assert(p.digest===hash(p.payload),'PLAN_CHANGED','操作预览摘要变化，停止同步');found.push(p);}return found.sort((a,b)=>b.payload.createdAt.localeCompare(a.payload.createdAt));}
function rowsFor(s,ps,existingKeys) {
  const rows=[],used=new Set(),at=now();let history=0;
  for(const p of ps) {
    for(const src of p.payload.sources)used.add(src.id);
    if(['complete','cancelled','superseded'].includes(p.state)&&history++>=10&&!p.payload.actions.some((a,i)=>existingKeys.has(`plan:${p.payload.operation}:${i+1}`)))continue;
    for(let i=0;i<p.payload.actions.length;i++){const a=p.payload.actions[i],step=p.steps[i],unknown=['sending','unknown','needs_review'].includes(step.state),done=p.state==='complete',retired=['cancelled','superseded'].includes(p.state);
      const sources=p.payload.sources.map(src=>s.documents.find(d=>d.id===src.id)).filter(Boolean);
      const status=unknown?'写入待查证':done?'已完成':retired?'暂缓':'待确认';
      rows.push({'记录键':`plan:${p.payload.operation}:${i+1}`,'条目名称':a.title||s.documents.find(d=>d.id===a.documentId)?.title||p.payload.purpose,'事项类型':[a.kind==='create'?'新资料入库':'已有文档更新'],'状态':[status],'来源链接':sources[0]?.sourceUrl||sources[0]?.url||'','目标分类':a.classification?.destination?.path?.map(x=>x.title).join(' / ')||a.parent||a.doc||'','变更前':a.kind==='create'?'尚未创建':a.pattern||`当前文档：${a.doc}；预览基线：${a.baseHash}`,'变更后／完整预览':`${a.content}\n\n预览摘要：${p.digest}\n${a.classification?JSON.stringify(a.classification):''}`,'读取覆盖':sources.map(d=>`${d.title}：${d.coverage||'未知'}`).join('；'),'原因与下一步':unknown?`结果尚未核实（${step.error?.code||step.state}）；先 diagnose/recover，不能重发`:done?'已回读核验':retired?`已${p.state==='cancelled'?'取消':'替代'}；${p.retirementReason||p.reason||''}`:'核对正文、标题与分类后，向Agent明确确认本预览；表内状态不授权执行','结果文档':step.state==='verified'?step.url||'':'','最近更新':p.completedAt||step.verifiedAt||step.startedAt||p.payload.createdAt});
    }
  }
  for(const d of knowledgeDocuments(s).filter(live).filter(d=>(d.recordRole==='input'||(d.recordRole===undefined&&d.remote===false))&&d.hash!==d.processedHash&&!used.has(d.id)))rows.push({'记录键':`input:${d.id}`,'条目名称':d.title,'事项类型':['异常资料处理'],'状态':[d.ingestIssue?.status||(d.coverage==='link_only'?'待补材料':'待确认')],'来源链接':d.sourceUrl||d.url||'','目标分类':'','变更前':'尚无已核验的整理结果','变更后／完整预览':'','读取覆盖':d.coverage||'未知','原因与下一步':d.ingestIssue?`${d.ingestIssue.reason}；${d.ingestIssue.next}`:d.coverage==='link_only'?'只有链接；补充正文或本人完成平台登录后读取':'已获取材料；按个人偏好整理并生成具体预览','结果文档':'','最近更新':d.ingestIssue?.at||d.fetchedAt||d.createdAt||at});
  for(const error of s.lastSync?.failures||[]) {const d=knowledgeDocuments(s).find(d=>d.id===error.id);if(d)rows.push({'记录键':`read:${d.id}`,'条目名称':d.title,'事项类型':['异常资料处理'],'状态':['读取失败'],'来源链接':d.url||'','读取覆盖':'本次读取失败','原因与下一步':`${error.code}；核对权限或链接后再次读取`,'最近更新':s.lastSync.at});}
  return rows;
}
function mainText(s,rows) {
  const docs=knowledgeDocuments(s).filter(live).filter(d=>d.remote!==false),counts=status=>rows.filter(r=>r['状态'][0]===status).length;
  const notes=docs.filter(d=>['source','topic','experience'].includes(d.kind)),pending=rows.filter(r=>!['已完成','暂缓'].includes(r['状态'][0]));
  const eventTimes=[s.lastSync?.at,...rows.map(r=>r['最近更新'])].filter(Boolean).map(t=>Date.parse(t)).filter(Number.isFinite),updated=eventTimes.length?new Date(Math.max(...eventTimes)).toISOString():'暂无已核验事件';
  return `## ${HEAD.main[0]}\n\n所属知识库：${escape(s.name)}\n\n数据事件更新至：${updated}\n\n索引时间：${s.lastSync?.at||'尚未进行远端索引'}；目录${s.lastSync?.catalogComplete?'已完整':'未证实完整'}；本轮正文剩余 ${s.lastSync?.remainingThisPass??'未知'}。统计仅覆盖当前索引。\n\n${table(['书屋状态','数量'],[['已归档知识笔记',notes.length],['旧索引类型待核对',docs.filter(d=>d.kind==='document').length],['待确认变更',counts('待确认')],['异常待处理',counts('待补材料')+counts('读取失败')],['写入待查证',counts('写入待查证')]])}\n\n### 准备怎么改 / 哪些资料待处理\n\n${pending.length?table(['事项','状态','目标','下一步'],pending.map(r=>[r['条目名称'],r['状态'][0],r['目标分类'],r['原因与下一步']])):'当前索引和操作记录内没有待处理事项。'}\n\n完整正文、变更前后与备注在[多维表格](${s.workbench.base.wikiURL})；以下入口用于按状态筛选。活动事项完整保留，初次同步只回填最近10份终态计划；旧计划原样保留。\n\n${table(['视图','入口'],Object.entries(s.workbench.base.views||{}).map(([name,url])=>[name,link('打开',url)]))}\n\n[个人整理偏好](${s.workbench.pages.preferences.url}) · [主题更新建议](${s.workbench.pages.suggestions.url})\n\n用户意见会用于重新生成预览，表格中的状态或意见不是执行授权。文章已成功而工作台失败时，仅补同步管理信息。\n\n${HEAD.main[1]}`;
}
function suggestionsText(s) {const items=s.workbench.suggestions||[],pending=Object.values(s.workbench.topicReviews||{}).filter(x=>x.state==='pending');return `## ${HEAD.suggestions[0]}\n\n建议基于已读取的来源与已有主题；此处记录建议，不直接修改主题正文。\n\n待评估新资料：${pending.length}。${pending.map(x=>escape(x.title)).join('；')}\n\n${items.length?table(['来源 / 版本','主题 / 版本','类型','依据与建议'],items.map(x=>[x.sourceURL?link(x.sourceTitle,x.sourceURL,` / ${x.sourceHash.slice(0,8)}`):`${x.sourceTitle} / ${x.sourceHash.slice(0,8)}`,x.topicURL?link(x.topicTitle,x.topicURL,` / ${x.topicHash.slice(0,8)}`):'无匹配主题',x.kind,`${x.reason}；来源原文：${x.sourceEvidence||'—'}；主题原文：${x.topicEvidence||'—'}；${x.proposedText||''}`])):'尚未完成主题更新评估；没有建议记录不代表无需更新。'}\n\n${HEAD.suggestions[1]}`;}
async function writeRegion(home,s,l,key,text) {
  const p=s.workbench.pages[key],r=await l.workbenchRegion(p.url,...HEAD[key]);assert(r.document.id===p.id,'WORKBENCH_CHANGED','自动区域文档身份不符');
  const current=regionHash(r.text),expected=regionHash(text);if(current===expected){p.regionHash=current;delete p.pendingHash;await saveLibrary(home,s);return;}
  if(p.pendingHash===current){p.regionHash=current;delete p.pendingHash;await saveLibrary(home,s);}
  assert(!p.pendingHash && current===p.regionHash,'WORKBENCH_CONFLICT','自动区域已被修改或写入结果未知，先核对，不覆盖用户内容');
  p.pendingHash=expected;await saveLibrary(home,s);
  await l.workbenchWrite(p.url,r,text);
  const fresh=await l.workbenchRegion(p.url,...HEAD[key]);assert(regionHash(fresh.text)===expected,'WORKBENCH_VERIFY','管理页回读不符，不能重发');p.regionHash=expected;delete p.pendingHash;await saveLibrary(home,s);
}
export async function syncWorkbench(home,id,supplied) {
  let s;
  try {s=await loadLibrary(home,id);if(!s.workbench)return {status:'not-configured'};const l=client(s,supplied);await l.assertAccount(s);for(const p of Object.values(s.workbench.pages))await l.inScope(p.url,[s.writeRoot]);await baseScope(s,l);
    const existing=await l.workbenchRows(s.workbench.base),map=new Map();
    for(const r of existing){const key=r.fields['记录键'];if(!key)continue;assert(!map.has(key),'WORKBENCH_DUPLICATE','Base存在重复记录键，先核对');map.set(key,r);}
    const rows=rowsFor(s,await plans(home,s),new Set(map.keys()));
    // Linked-only input rows remain in history when a preview takes over; no deletion.
    for(const old of existing.filter(r=>String(r.fields['记录键']).startsWith('input:')&&!rows.some(x=>x['记录键']===r.fields['记录键'])))rows.push({...old.fields,'状态':['暂缓'],'原因与下一步':'已有后续预览或本地已处理，查看对应变更记录；历史保留'});
    for(const old of existing.filter(r=>String(r.fields['记录键']).startsWith('read:')&&!rows.some(x=>x['记录键']===r.fields['记录键']))){const d=knowledgeDocuments(s).find(d=>`read:${d.id}`===old.fields['记录键']);rows.push({...old.fields,...(d&&!d.unavailable&&!d.outOfScope?{'状态':['已完成'],'原因与下一步':'后续索引已成功读取此文档；仅表示读取恢复','最近更新':d.fetchedAt||old.fields['最近更新']}:{})});}
    for(const row of rows)delete row['我的备注／调整意见'];
    for(const row of rows){const key=row['记录键'],old=map.get(key),memo=s.workbench.records[key];const fingerprint=hash(row);
      if(memo?.pending && !old)throw Object.assign(new Error('记录创建结果未知，先查证'),{code:'WORKBENCH_UNCERTAIN'});
      const same=old && Object.entries(row).every(([k,v])=>JSON.stringify(old.fields[k]??'')===JSON.stringify(v));
      if(!same){s.workbench.records[key]={...memo,pending:true};await saveLibrary(home,s);const recordId=await l.workbenchUpsert(s.workbench.base,old?.recordId,row);s.workbench.records[key]={recordId,fingerprint};await saveLibrary(home,s);}
    }
    // Verify machine-owned fields. The memo column is deliberately omitted from writes.
    const checked=await l.workbenchRows(s.workbench.base);for(const row of rows){const r=checked.find(x=>x.fields['记录键']===row['记录键']);assert(r&&Object.entries(row).every(([k,v])=>JSON.stringify(r.fields[k]??'')===JSON.stringify(v)),'WORKBENCH_VERIFY','Base明细回读不符');}
    await writeRegion(home,s,l,'main',mainText(s,rows));await writeRegion(home,s,l,'suggestions',suggestionsText(s));
    s.workbench.sync={status:'complete',at:now(),rows:rows.length};await saveLibrary(home,s);return s.workbench.sync;
  }catch(e){const result={status:'pending',at:now(),code:e.code||'ERROR',diagnostic:e.details||{},note:'仅管理信息待同步；不重发文章'};if(s?.workbench){s.workbench.sync=result;try{await saveLibrary(home,s);}catch(persistError){return {...result,persistence:'failed',persistenceCode:persistError.code||'ERROR'};}}return result;}
}
export async function recordTopicSuggestions(home,id,spec,supplied) {
  const s=await loadLibrary(home,id),l=client(s,supplied);assert(s.workbench,'WORKBENCH_REQUIRED','先确认创建或绑定管理页');await l.assertAccount(s);
  const source=knowledgeDocuments(s).find(d=>d.id===spec.sourceId&&live(d));assert(source?.hash===spec.sourceHash&&['full_text','partial','transcript'].includes(source.coverage),'SUGGESTION_SOURCE','来源版本或正文覆盖不符');
  if(source.remote!==false){await l.inScope(source.url,s.readRoots);assert(hash((await l.fetch(source.url)).markdown)===source.hash,'SOURCE_CHANGED','来源已变化，重新读取');}
  assert(Array.isArray(spec.topics)&&spec.topics.length<=12,'SUGGESTIONS','建议最多12项');const added=[];
  for(const item of spec.topics) {const topic=knowledgeDocuments(s).find(d=>d.id===item.id&&d.kind==='topic'&&live(d));assert(topic&&topic.hash===item.hash,'SUGGESTION_TOPIC','需要当前已有主题及版本');await l.inScope(topic.url,s.readRoots);const fresh=await l.fetch(topic.url);assert(fresh.id===topic.id&&hash(fresh.markdown)===topic.hash,'TOPIC_CHANGED','主题内容变化，重新评估');
    assert(['补充','冲突','时效'].includes(item.kind)&&item.reason?.trim()&&item.reason.length<=500&&item.proposedText?.trim()&&item.proposedText.length<=3000,'SUGGESTION_CONTENT','需要建议类型、原因和具体拟补充内容');assert(item.sourceEvidence?.trim()&&item.sourceEvidence.length<=500&&source.markdown.includes(item.sourceEvidence)&&item.topicEvidence?.trim()&&item.topicEvidence.length<=500&&fresh.markdown.includes(item.topicEvidence),'SUGGESTION_EVIDENCE','建议必须提供双方各500字符以内的实际原文依据');
    added.push({key:hash([source.id,source.hash,topic.id,topic.hash]),sourceId:source.id,sourceHash:source.hash,sourceTitle:source.title,sourceURL:source.sourceUrl||source.url,topicId:topic.id,topicHash:topic.hash,topicTitle:topic.title,topicURL:topic.url,...item,at:now()});}
  if(!spec.topics.length){assert(spec.reason?.trim()&&spec.reason.length<=500,'SUGGESTION_REASON','无匹配主题时说明实际检查范围');added.push({key:hash([source.id,source.hash,'none']),sourceId:source.id,sourceHash:source.hash,sourceTitle:source.title,kind:'本次无建议',reason:spec.reason,at:now()});}
  for(const a of added){const index=s.workbench.suggestions.findIndex(x=>x.key===a.key);if(index>=0)s.workbench.suggestions[index]=a;else s.workbench.suggestions.push(a);}s.workbench.topicReviews||={};s.workbench.topicReviews[hash([source.id,source.hash])]={title:source.title,state:'reviewed',at:now()};await saveLibrary(home,s);return {recorded:added.length,knowledgeChanged:false,workbench:await syncWorkbench(home,id,l)};
}
