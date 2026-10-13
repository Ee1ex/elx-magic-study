import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { identifier, libraryPath, loadLibrary, readJSON, stateHome, writeNew } from '../skills/elx-magic-study/scripts/store.mjs';

function paths(home, libraryId, operationId) {
  const base = path.join(libraryPath(home, libraryId), 'mcp-approvals');
  const name = identifier(operationId);
  return { approval: path.join(base, name + '.json'), used: path.join(base, name + '.used') };
}

export async function inspectPlan(home, libraryId, operationId, previewOnly = false) {
  const state = await loadLibrary(home, libraryId);
  const plan = await readJSON(path.join(libraryPath(home, state.id), 'operations', identifier(operationId) + '.json'));
  if ((previewOnly && plan.state !== 'preview') || plan.payload.library !== state.id || plan.payload.account !== state.account || JSON.stringify(plan.payload.writeRoot) !== JSON.stringify(state.writeRoot)) throw Object.assign(new Error('计划状态或绑定已变化'), { code: 'PLAN_CHANGED' });
  return { state, plan };
}

export async function createApproval(home, libraryId, operationId, digest) {
  const { state, plan } = await inspectPlan(home, libraryId, operationId, true);
  if (plan.digest !== digest) throw Object.assign(new Error('摘要与计划不一致'), { code: 'PLAN_CHANGED' });
  const { approval, used } = paths(home, state.id, operationId);
  if (await fs.stat(used).then(() => true, () => false)) throw Object.assign(new Error('此计划的批准已消费；先查证操作状态'), { code: 'APPROVAL_USED' });
  const token = randomUUID();
  try { await writeNew(approval, JSON.stringify({ token, operationId, digest, libraryId: state.id, account: state.account, writeRoot: state.writeRoot, at: new Date().toISOString() }) + '\n'); }
  catch (error) { if (error.code === 'EEXIST') throw Object.assign(new Error('此计划已有批准凭据，不能重新签发'), { code: 'APPROVAL_EXISTS' }); throw error; }
  return token;
}

export async function consumeApproval(home, libraryId, operationId, digest, token) {
  const { state, plan } = await inspectPlan(home, libraryId, operationId);
  const { approval, used } = paths(home, state.id, operationId);
  const saved = await readJSON(approval);
  if (plan.digest !== digest || saved.token !== token || saved.digest !== digest || saved.libraryId !== state.id || saved.account !== state.account || JSON.stringify(saved.writeRoot) !== JSON.stringify(state.writeRoot)) throw Object.assign(new Error('批准凭据与当前计划不匹配'), { code: 'APPROVAL_MISMATCH' });
  if (await fs.stat(used).then(() => true, () => false)) {
    const steps = plan.steps || [];
    if (['applying', 'incomplete'].includes(plan.state) && steps.some(s => s.state === 'verified') && steps.some(s => s.state === 'pending') && steps.every(s => ['verified', 'pending'].includes(s.state))) return;
    throw Object.assign(new Error('凭据已消费；先查证操作状态'), { code: 'APPROVAL_USED' });
  }
  if (plan.state !== 'preview') throw Object.assign(new Error('计划不是待批准预览'), { code: 'PLAN_CHANGED' });
  try { await writeNew(used, JSON.stringify({ operationId, digest, at: new Date().toISOString() }) + '\n'); }
  catch (error) { if (error.code === 'EEXIST') throw Object.assign(new Error('凭据已消费；先查证操作状态'), { code: 'APPROVAL_USED' }); throw error; }
}

export const approvalHome = () => stateHome(process.env.ELX_MAGIC_STUDY_MCP_HOME);
