import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { assert, hash, now, identifier, libraryPath, loadLibrary, saveLibrary, readJSON, writeJSON } from './store.mjs';
import { Lark } from './lark.mjs';
import { classificationPath } from './classification.mjs';

// Observations are supplied by the host's visible browser tools, not by a hidden API.
export function iconDecision(previous, observed, suggestion) {
  if (previous?.mode === 'manual' || (previous?.mode === 'auto' && previous.icon !== observed) || (!previous?.mode && observed !== null)) return { action: 'preserve', reason: '已有图标或手动修改优先保留' };
  if (!suggestion.icon || !suggestion.theme?.trim()) return { action: 'pending', reason: '主题或图标不明确，待设置' };
  if (previous?.mode === 'auto' && previous.theme === suggestion.theme) return { action: 'keep', reason: '主题未变，保持已验证的自动图标' };
  if (observed === suggestion.icon) return { action: 'keep', reason: '当前图标已匹配' };
  return { action: 'set', reason: '为明确主题设置原生图标' };
}
const iconFile = (home, id, operation) => path.join(libraryPath(home, id), 'icon-plans', identifier(operation) + '.json');
function validIcon(icon) {
  if (icon === null) return;
  assert(typeof icon === 'string' && icon.length <= 24 && [...new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(icon)].length === 1 && /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(icon), 'ICON_VALUE', '建议图标必须是飞书面板中可见的单个表情；不在标题里加字符');
}
function shortText(value, max, code) { assert(typeof value === 'string' && value.trim() && value.length <= max && !/[\r\n\x00-\x1f]/.test(value), code, '需要简短、非空的单行说明'); return value.trim(); }

export async function planCategoryIcon(home, id, spec, supplied) {
  const state = await loadLibrary(home, id), lark = supplied || new Lark(state.profile);
  assert(state.provider === 'feishu' && state.writeRoot, 'WRITE_DISABLED', '需要已有飞书写入范围');
  const document = state.documents.find(d => d.id === spec.documentId && d.kind === 'index' && !d.unavailable && !d.outOfScope);
  assert(document, 'ICON_CATEGORY', '仅为已索引的分类导航页准备图标；不处理普通笔记');
  validIcon(spec.icon); const reason = shortText(spec.reason, 300, 'ICON_REASON');
  const theme = spec.theme ? shortText(spec.theme, 100, 'ICON_THEME') : '';
  const observation = spec.observation;
  assert(observation && (observation.icon === null || (typeof observation.icon === 'string' && observation.icon.length <= 200)), 'ICON_OBSERVATION', '需要实际网页观察；没有图标明确用 null，无法辨认则先停止');
  await lark.assertAccount(state); await lark.inScope(observation.url, [state.writeRoot]);
  const node = await lark.node(observation.url);
  assert(node.obj_token === document.id && node.title === observation.title, 'ICON_TARGET', '网页观察目标与分类文档不一致');
  const canonicalURL = `${state.writeRoot.origin}/wiki/${node.node_token}`;
  const location = await classificationPath(state, lark, canonicalURL);
  const fresh = await lark.fetch(canonicalURL); assert(fresh.id === document.id, 'ICON_TARGET', '文档身份变化');
  const previous = state.categoryIcons?.[document.id];
  const decision = iconDecision(previous, observation.icon, { icon: spec.icon, theme });
  const operation = randomUUID();
  const payload = { operation, library: state.id, account: state.account, writeRoot: state.writeRoot, documentId: document.id, title: node.title, location, bodyHash: hash(fresh.markdown), observedIcon: observation.icon, icon: spec.icon, theme, reason, decision, createdAt: now() };
  const plan = { payload, digest: hash(payload), state: 'planned' };
  await writeJSON(iconFile(home, state.id, operation), plan);
  state.categoryIcons ||= {};
  state.categoryIcons[document.id] = { ...previous, plan: operation, status: decision.action === 'set' ? 'planned' : decision.action, ...(decision.action === 'preserve' ? { mode: 'manual', icon: observation.icon } : {}) };
  await saveLibrary(home, state);
  return { plan: operation, digest: plan.digest, documentId: document.id, title: node.title, url: canonicalURL, previousIcon: observation.icon, icon: spec.icon, theme, decision, remoteChanged: false,
    next: decision.action === 'set' ? '由宿主浏览器操作原生选择器；刷新核对后 icon-record。打不开、无权限或未确认结果就记录 pending。' : '保持网页不变；仅保存此次检查结果。' };
}

export async function recordCategoryIcon(home, id, operation, receipt, supplied) {
  const state = await loadLibrary(home, id), file = iconFile(home, state.id, operation), plan = await readJSON(file), p = plan.payload;
  assert(plan.digest === hash(p) && p.library === state.id && p.account === state.account && hash(p.writeRoot) === hash(state.writeRoot), 'ICON_PLAN', '图标计划或绑定已变化');
  const record = state.categoryIcons?.[p.documentId];
  assert(record?.plan === operation, 'ICON_PLAN_STALE', '已有更新的图标计划，旧回执不能覆盖');
  assert(p.decision.action === 'set' && ['planned', 'pending'].includes(plan.state), 'ICON_PLAN', '该计划不需要设置或已完成，不重复记录');
  assert(['verified', 'pending'].includes(receipt.outcome), 'ICON_RECEIPT', '回执只能为 verified 或 pending');
  if (receipt.outcome === 'pending') {
    const reason = shortText(receipt.reason, 500, 'ICON_REASON');
    plan.state = 'pending'; plan.receipt = { reason, recordedAt: now() }; record.status = 'pending'; record.pendingReason = reason;
  } else {
    assert(receipt.reloaded === true && receipt.icon === p.icon && receipt.title === p.title && typeof receipt.evidence === 'string' && path.isAbsolute(receipt.evidence), 'ICON_EVIDENCE', '需要刷新后图标／标题一致以及本机浏览器证据路径');
    assert(await fs.stat(receipt.evidence).then(s => s.isFile()).catch(() => false), 'ICON_EVIDENCE', '浏览器证据文件不存在');
    const lark = supplied || new Lark(state.profile); await lark.assertAccount(state); await lark.inScope(receipt.url, [state.writeRoot]);
    const node = await lark.node(receipt.url), actual = await lark.fetch(p.location.url);
    const location = await classificationPath(state, lark, p.location.url);
    assert(node.obj_token === p.documentId && node.title === p.title && actual.id === p.documentId && hash(actual.markdown) === p.bodyHash && hash(location) === hash(p.location), 'ICON_DOCUMENT_CHANGED', '目标、路径、标题或正文变化，不能把本次记为只改图标');
    plan.state = 'verified'; plan.receipt = { icon: receipt.icon, title: receipt.title, reloaded: true, evidence: receipt.evidence, recordedAt: now(), source: 'host-browser-observation' };
    Object.assign(record, { status: 'verified', mode: 'auto', icon: p.icon, theme: p.theme, verifiedAt: now(), evidence: receipt.evidence }); delete record.pendingReason;
  }
  await writeJSON(file, plan); await saveLibrary(home, state);
  return { plan: operation, state: plan.state, documentId: p.documentId, remoteChangedByScript: false, note: '脚本核对身份与正文；原生图标结果依据宿主提供的网页刷新观察，不是公开API读取。' };
}

export const pendingCategoryIcons = state => Object.entries(state.categoryIcons || {}).filter(([, r]) => ['pending', 'planned'].includes(r.status)).map(([documentId, r]) => ({ documentId, title: state.documents.find(d => d.id === documentId)?.title || documentId, plan: r.plan, status: r.status, reason: r.pendingReason || '等待网页设置与刷新核对' }));
