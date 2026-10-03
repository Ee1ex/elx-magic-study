#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stateHome, loadLibrary, libraryPath, readJSON, writeJSON, writeNew, locked, assert, identifier, now } from './store.mjs';
import { Lark } from './lark.mjs';
import { search, lint } from './retrieval.mjs';
import { pendingContentClassification } from './classification.mjs';
import { exportGraph } from './graph.mjs';
import { doctor, bind, importManifest, sync, fetchDocument, capture, sourceContent, makePlan, applyPlan, recoverPlan, maintenance, schedulePrompt, classifyDocument, intakeQueue, planOverview, retirePlan, diagnosePlan, classificationContext } from './library-core.mjs';

const HELP = {
  version: '0.3.0', usage: 'node <SKILL_ROOT>/scripts/library.mjs <command> [--home <个人状态目录>] [--library <编号>]',
  commands: {
    doctor: '只读检查 Node、飞书 CLI、用户授权和绑定；不登录或改权限',
    bind: '--id <编号> --root <Wiki/docx链接> [重复] --write-root <Wiki链接> --confirm；只保存已确认绑定',
    status: '显示当前库范围、索引覆盖和实际记录的调度任务',
    sync: '[--max-docs 30] [--max-nodes 500]；[--force] [--restart-scan]；目录与正文分别续扫授权范围，零远端写入',
    search: '--query <问题关键词> [重复] [--limit 8] [--offline]；本地 BM25 和引用邻居',
    fetch: '--id <已索引文档编号>；回远端核对后返回正文',
    capture: '--url <来源链接> --title <标题> [--note <备注>]；仅生成本地来源记录',
    'source-content': '--id <来源编号> --file <UTF8正文> --coverage partial|full_text|transcript --note <获取方式>；仅本地快照',
    'classification-context': '--id <输入来源编号> [--query <正文关键词>] [--limit 300]；只读分类位置、已有标签与主题候选',
    classify: '--id <文档编号> --role input|derived|navigation --confirm；确认后仅设置该条本地角色',
    plan: '--file <动作JSON>；读取基线并生成可审核的飞书增改计划',
    plans: '列出操作状态、来源版本和结果链接，供定时任务去重',
    'plan-show': '--id <计划编号>；读取完整计划',
    'plan-cancel': '--id <计划编号> --approve <digest> --reason <原因>；仅终止未发送计划',
    'plan-supersede': '--id <旧计划> --replacement <新计划> --approve <旧digest> --reason <原因>；标记替代关系',
    diagnose: '--id <计划> --step <序号> [--doc <结果URL>]；只读差异诊断，不改变计划状态',
    apply: '--id <计划编号> --approve <预览digest>；用户已确认后执行并回读',
    recover: '--id <计划编号> --step <序号> [--doc <确认的结果URL>]；只查证，不重发',
    lint: '[--stale-days 180] [--offline]；本地只读检查，语义矛盾由Agent核对',
    graph: '--output <新HTML路径> [--limit 300] [--offline]；可交互离线知识图谱，不覆盖旧文件',
    maintenance: '[--refresh]；定时执行入口，只读飞书＋本地索引／检查，不apply',
    'schedule-plan': '--time HH:MM --timezone <IANA时区> [--days MO,TU,...] --output <新JSON>；生成宿主任务所需提示，不等于已注册',
    'schedule-record': '--file <真实调度回执JSON>；记录实际任务ID，不创建系统任务',
    'demo-import': '--id <新编号> --file <demo:true清单>；导入合成样本，不连接飞书'
  }, note: '首次使用读 references/setup.md；授权URL/二维码由当前Agent调用 lark-cli 引导，脚本不收集密钥。'
};
function parse(argv) {
  const [command = 'help', ...args] = argv; const options = {};
  const boolean = new Set(['confirm', 'offline', 'refresh', 'force', 'restart-scan']);
  const allowed = new Set(['home', 'library', 'profile', 'id', 'root', 'write-root', 'name', 'query', 'limit', 'max-docs', 'max-nodes', 'url', 'title', 'note', 'file', 'coverage', 'approve', 'step', 'doc', 'stale-days', 'output', 'time', 'timezone', 'days', 'role', 'replacement', 'reason', ...boolean]);
  for (let i = 0; i < args.length; i++) { assert(args[i].startsWith('--'), 'ARGUMENT', '参数使用 --name value 形式'); const key = args[i].slice(2); assert(allowed.has(key), 'ARGUMENT', `未知参数 ${key}`); const value = boolean.has(key) ? true : args[++i]; assert(value !== undefined && !String(value).startsWith('--'), 'ARGUMENT', `参数 ${key} 缺少值`); if (['root', 'query'].includes(key)) (options[key] ||= []).push(value); else { assert(!(key in options), 'ARGUMENT', `参数 ${key} 不能重复`); options[key] = value; } }
  return { command, options };
}
function number(value, fallback, min, max) { const n = value === undefined ? fallback : Number(value); assert(Number.isInteger(n) && n >= min && n <= max, 'LIMIT', `数量必须在 ${min}—${max} 之间`); return n; }
async function localAccess(state, offline) { if (state.provider === 'feishu' && !offline) await new Lark(state.profile).assertAccount(state); }
export async function run(argv) {
  const { command, options: o } = parse(argv), home = stateHome(o.home);
  if (command === 'help' || command === '--help') return HELP;
  if (command === 'doctor') return doctor(home, o.profile);
  const mutations = new Set(['bind','demo-import','sync','fetch','capture','source-content','classify','plan','plan-cancel','plan-supersede','apply','recover','maintenance','schedule-record']);
  const execute = async () => {
    if (command === 'bind') return bind(home, { id: o.id, name: o.name, profile: o.profile, readRoots: o.root, writeRoot: o['write-root'], confirmed: !!o.confirm });
    if (command === 'demo-import') return importManifest(home, o.id, await readJSON(o.file));
    const state = await loadLibrary(home, o.library); const id = state.id;
    if (command === 'status') { const queue = intakeQueue(state.documents); const plans = await planOverview(home, state); const tasks = {}; for (const p of plans) tasks[p.label] = (tasks[p.label] || 0) + 1; return { id, name: state.name, provider: state.provider, readRoots: state.readRoots, writeRoot: state.writeRoot, indexed: state.documents.length, pendingInputs: queue.pending.length, needsClassification: queue.needsClassification.length, pendingContentClassification: pendingContentClassification(state.documents).length, tasks, lastSync: state.lastSync || null, schedules: state.schedules || [], next: state.documents.length ? '可 search、graph 或 maintenance；回答重要问题前 fetch 最新正文' : '先 sync 建立索引' }; }
    if (command === 'sync') return sync(home, id, { maxDocs: number(o['max-docs'], 30, 1, 200), maxNodes: number(o['max-nodes'], 500, 1, 5000), force: !!o.force, restartScan: !!o['restart-scan'] });
    if (command === 'fetch') return fetchDocument(home, id, o.id);
    if (command === 'capture') return capture(home, id, { url: o.url, title: o.title, note: o.note });
    if (command === 'classification-context') return classificationContext(home, id, o.id, { queries: o.query || [], limit: number(o.limit, 300, 1, 1000) });
    if (command === 'classify') return classifyDocument(home, id, o.id, o.role, !!o.confirm);
    if (command === 'source-content') return sourceContent(home, id, o.id, { markdown: await fs.readFile(o.file, 'utf8'), coverage: o.coverage, sourceNote: o.note });
    if (command === 'plan') return makePlan(home, id, await readJSON(o.file));
    if (command === 'plans') return { plans: await planOverview(home, state) };
    if (command === 'plan-cancel' || command === 'plan-supersede') { if (command === 'plan-supersede') assert(o.replacement, 'REPLACEMENT', '需要明确新计划编号'); return retirePlan(home, id, o.id, { approval: o.approve, reason: o.reason, replacement: command === 'plan-supersede' ? o.replacement : undefined }); }
    if (command === 'diagnose') return diagnosePlan(home, id, o.id, number(o.step, 1, 1, 12), o.doc);
    if (command === 'plan-show') return readJSON(path.join(libraryPath(home, id), 'operations', identifier(o.id) + '.json'));
    if (command === 'apply') return applyPlan(home, id, o.id, o.approve);
    if (command === 'recover') return recoverPlan(home, id, o.id, number(o.step, 1, 1, 12), o.doc);
    if (command === 'maintenance') return maintenance(home, id, { refresh: !!o.refresh });
    if (command === 'search') { await localAccess(state, o.offline); assert(o.query?.some(q => q.trim()), 'QUERY', '请提供至少一个非空关键词'); return search(state.documents, o.query, { limit: number(o.limit, 8, 1, 30) }); }
    if (command === 'lint') { await localAccess(state, o.offline); return lint(state.documents, { staleDays: number(o['stale-days'], 180, 1, 36500) }); }
    if (command === 'graph') { await localAccess(state, o.offline); assert(o.output, 'OUTPUT', '需要明确图谱输出路径'); return exportGraph(state.documents, path.resolve(o.output), { maxNodes: number(o.limit, 300, 1, 1000), title: state.name + ' · 知识关系图谱', demo: state.provider === 'demo' }); }
    if (command === 'schedule-plan') {
      assert(state.provider === 'feishu', 'DEMO_ONLY', '不为演示库安排真实定时任务');
      assert(/^([01]\d|2[0-3]):[0-5]\d$/.test(o.time || ''), 'TIME', '需要用户明确的 HH:MM');
      try { new Intl.DateTimeFormat('zh-CN', { timeZone: o.timezone }).format(); } catch { throw new Error('请提供有效 IANA 时区'); }
      assert(o.timezone && o.output, 'SCHEDULE', '需要明确时区与输出文件');
      const days = (o.days || 'MO,TU,WE,TH,FR,SA,SU').split(','); assert(days.every(d => ['MO','TU','WE','TH','FR','SA','SU'].includes(d)), 'DAYS', '使用 MO,TU,WE,TH,FR,SA,SU');
      const spec = { state: 'proposal-not-registered', library: id, timezone: o.timezone, time: o.time, days: [...new Set(days)], name: `魔法书屋维护 ${state.name}`, kind: 'heartbeat', prompt: schedulePrompt(state, fileURLToPath(new URL('..', import.meta.url)), home), existing: state.schedules, next: '读取 maintenance.md，通过宿主 automation_update 实际注册并回读；不要把此文件称为已启用任务' };
      await writeNew(o.output, JSON.stringify(spec, null, 2)); return { file: path.resolve(o.output), ...spec };
    }
    if (command === 'schedule-record') {
      const receipt = await readJSON(o.file); assert(receipt.provider === 'codex-heartbeat' && typeof receipt.automationId === 'string' && receipt.automationId && receipt.status && receipt.timezone && receipt.time, 'RECEIPT', '回执必须来自已成功的宿主调度注册，包含 provider、automationId、status、timezone、time');
      state.schedules = (state.schedules || []).filter(s => s.automationId !== receipt.automationId); state.schedules.push({ ...receipt, recordedAt: now() }); await saveLibrary(home, state); return { recorded: receipt.automationId, note: '这是宿主回执记录；本脚本未创建或验证调度器执行。' };
    }
    throw new Error('未知命令；运行 help 查看入口');
  };
  return mutations.has(command) ? locked(home, execute) : execute();
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify({ ok: true, data: await run(process.argv.slice(2)) }, null, 2)); }
  catch (e) { console.error(JSON.stringify({ ok: false, error: { code: e.code || 'ERROR', message: e.message, details: e.details || {} } }, null, 2)); process.exitCode = 1; }
}
