import * as z from 'zod/v4';
import { runWorker } from './runner.mjs';

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const queries = z.array(z.string().trim().min(1).max(200)).min(1).max(8);
const action = z.record(z.string(), z.unknown());

const entries = [
  ['study_status', 'status', '查看已绑定知识库、覆盖及待办。', z.object({})],
  ['study_doctor', 'doctor', '检查本机依赖、飞书授权与绑定；不登录。', z.object({})],
  ['study_search', 'search', '按索引搜索文档；重要结论再读取最新正文。', z.object({ query: queries, limit: z.number().int().min(1).max(30).optional(), offline: z.boolean().optional() })],
  ['study_records_search', 'record-search', '搜索个人表格条目；随机仅从已核实候选 ID 中抽取。', z.object({ query: z.array(z.string().trim().min(1).max(200)).max(8).optional(), filters: z.record(z.string(), z.string().max(200)).optional(), random: z.boolean().optional(), eligibleIds: z.array(id).max(100).optional(), limit: z.number().int().min(1).max(50).optional(), offline: z.boolean().optional() })],
  ['study_fetch', 'fetch', '读取已索引文档的最新正文并更新本地缓存。', z.object({ documentId: id })],
  ['study_record_context', 'record-context', '核对个人文档原生表格、动态表头和正文基线。', z.object({ documentId: id, offline: z.boolean().optional() })],
  ['study_workbench_context', 'workbench-context', '读取整理偏好与用户意见；沿用现有工作台逻辑。', z.object({})],
  ['study_sync', 'sync', '有界同步授权范围的目录和正文，保留扫描断点。', z.object({ maxDocs: z.number().int().min(1).max(200).optional(), maxNodes: z.number().int().min(1).max(5000).optional(), restartScan: z.boolean().optional() })],
  ['study_plan', 'plan', '生成最多两步的单目标写入预览；可能同步已配置的管理页。', z.object({ purpose: z.string().min(1).max(200), actions: z.array(action).min(1).max(2), sources: z.array(action).max(12).optional() })],
  ['study_operation', 'plan-show', '查看计划正文、摘要、步骤和结果；不可作为批准。', z.object({ operationId: id })],
  ['study_operations', 'plans', '有界查看已有操作概况与待查证状态。', z.object({})],
  ['study_apply', 'apply', '执行本机人工批准的精确计划；需要一次性批准凭据。', z.object({ operationId: id, digest: z.string().regex(/^[a-f0-9]{64}$/), approvalToken: z.string().uuid() })],
  ['study_recover', 'recover', '核对未知写入，按原计划恢复状态；不会重新发送新增。', z.object({ operationId: id, step: z.number().int().min(1).max(12), resultUrl: z.url().optional() })]
];

function result(data) {
  const payload = { status: 'ok', data };
  return { content: [{ type: 'text', text: JSON.stringify(payload) }], structuredContent: payload };
}
function failure(error) {
  const code = String(error.code || 'ERROR').replace(/[^A-Z0-9_]/g, '').slice(0, 60) || 'ERROR';
  const payload = { status: 'error', code, nextAction: code === 'UNKNOWN_RESULT' || code === 'APPROVAL_USED' ? '先调用 study_operation 和 study_recover 查证，禁止重新执行写入' : '检查状态、参数与绑定后再处理' };
  return { content: [{ type: 'text', text: JSON.stringify(payload) }], structuredContent: payload, isError: true };
}

export function registerStudyTools(server, runner = runWorker) {
  for (const [name, command, description, inputSchema] of entries) {
    server.registerTool(name, { description, inputSchema }, async args => {
      try { return result(await runner({ action: command, args }, command === 'sync' || command === 'apply' ? 180000 : 90000)); }
      catch (error) { return failure(error); }
    });
  }
}
