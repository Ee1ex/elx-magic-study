#!/usr/bin/env node
import { run } from '../skills/elx-magic-study/scripts/library.mjs';
import { consumeApproval } from './approval.mjs';
import { identifier, stateHome } from '../skills/elx-magic-study/scripts/store.mjs';

const MAX = 2 * 1024 * 1024;
const home = stateHome(process.env.ELX_MAGIC_STUDY_MCP_HOME);
const library = process.env.ELX_MAGIC_STUDY_MCP_LIBRARY;

function command(action, args) {
  const base = [action, '--home', home];
  if (library && action !== 'doctor') base.push('--library', identifier(library));
  const value = (key, val) => { if (val !== undefined) base.push('--' + key, String(val)); };
  const repeat = (key, vals) => { for (const item of vals || []) value(key, item); };
  switch (action) {
    case 'doctor': case 'status': case 'plans': case 'workbench-context': break;
    case 'search': repeat('query', args.query); value('limit', args.limit); if (args.offline) base.push('--offline'); break;
    case 'record-search': repeat('query', args.query); value('limit', args.limit); if (args.filters) value('filter', JSON.stringify(args.filters)); if (args.random) base.push('--random'); if (args.offline) base.push('--offline'); break;
    case 'fetch': case 'record-context': value('id', identifier(args.documentId)); if (action === 'record-context' && args.offline) base.push('--offline'); break;
    case 'sync': value('max-docs', args.maxDocs); value('max-nodes', args.maxNodes); if (args.restartScan) base.push('--restart-scan'); break;
    case 'plan': break;
    case 'plan-show': case 'apply': value('id', identifier(args.operationId)); if (action === 'apply') value('approve', args.digest); break;
    case 'recover': value('id', identifier(args.operationId)); value('step', args.step); value('doc', args.resultUrl); break;
    default: throw Object.assign(new Error('不支持的操作'), { code: 'UNSUPPORTED' });
  }
  return base;
}

async function main(request) {
  const { action, args = {} } = request;
  if (action === 'record-search' && args.random && (!Array.isArray(args.eligibleIds) || args.eligibleIds.length === 0)) throw Object.assign(new Error('随机选择需要已核实的候选池'), { code: 'ELIGIBLE_IDS_REQUIRED' });
  if (action === 'apply') await consumeApproval(home, library, args.operationId, args.digest, args.approvalToken);
  if (action === 'plan' && (!Array.isArray(args.actions) || args.actions.length > 2 || args.actions.some(a => !['create', 'append', 'str_replace', 'record_append'].includes(a.kind)))) throw Object.assign(new Error('首版只支持最多两步单目标计划'), { code: 'UNSUPPORTED' });
  if (action === 'plan' && args.actions.length === 2 && !(args.actions[0].kind === 'create' && args.actions[0].category === 'shelf' && args.actions[1].kind === 'create' && args.actions[1].parentStep === 1)) throw Object.assign(new Error('两步计划仅支持新分类及其子文档'), { code: 'UNSUPPORTED' });
  if (action === 'plan-show') {
    const plan = await run(command(action, args));
    return { operationId: plan.payload.operation, state: plan.state, digest: plan.digest, purpose: plan.payload.purpose, actions: plan.payload.actions, steps: plan.steps };
  }
  if (action === 'plans') return { plans: (await run(command(action, args))).plans.slice(-50) };
  return run(command(action, args), action === 'plan' ? { plan: { purpose: args.purpose, actions: args.actions, sources: args.sources } } : action === 'record-search' ? { eligibleIds: args.eligibleIds } : {});
}

let raw = '';
process.stdin.setEncoding('utf8');
for await (const part of process.stdin) { raw += part; if (Buffer.byteLength(raw) > MAX) throw new Error('请求超过限制'); }
try { process.stdout.write(JSON.stringify({ ok: true, data: await main(JSON.parse(raw)) })); }
catch (error) { process.stdout.write(JSON.stringify({ ok: false, code: error.code || 'ERROR', message: error.message })); }
