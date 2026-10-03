import path from 'node:path';
import { stateHome, readJSON, writeJSON, assert, now } from './store.mjs';

const file = home => path.join(stateHome(home), 'onboarding.json');
const features = ['readingTools', 'opencli', 'schedule', 'icons', 'graph'];
const choices = ['ask', 'later', 'never', 'interested'];

export async function onboardingStatus(home) {
  const record = await readJSON(file(home), { schemaVersion: 1, choices: {} });
  assert(record.schemaVersion === 1 && record.choices && typeof record.choices === 'object', 'ONBOARDING_SCHEMA', '引导记录格式不匹配，保留原文件并核对');
  return { needsIntroduction: !record.introducedAt, introducedAt: record.introducedAt || null, choices: record.choices,
    note: '这是介绍和用户明确意向，不是安装、授权或任务启用状态。later在用户主动提起或明确要求重访前不再主动询问；never不再主动推荐。当前会话明确指令优先。' };
}

export async function recordOnboarding(home, patch) {
  assert(patch && typeof patch === 'object' && !Array.isArray(patch) && Object.keys(patch).every(k => ['introduced', 'choices'].includes(k)), 'ONBOARDING_RECORD', '只记录已展示介绍和明确偏好，不保存聊天或凭据');
  assert(patch.introduced === undefined || patch.introduced === true, 'ONBOARDING_RECORD', 'introduced只用于实际展示介绍后记录true');
  const updates = patch.choices || {};
  assert(typeof updates === 'object' && !Array.isArray(updates) && Object.entries(updates).every(([k,v]) => features.includes(k) && choices.includes(v)), 'ONBOARDING_CHOICE', '偏好只支持ask/later/never/interested，不把意向标记为enabled');
  const current = await onboardingStatus(home);
  const record = { schemaVersion:1, introducedAt:current.introducedAt, choices:{...current.choices,...updates}, updatedAt:now() };
  if (patch.introduced && !record.introducedAt) record.introducedAt = now();
  await writeJSON(file(home), record);
  return { recorded:true, ...await onboardingStatus(home), externalChanged:false };
}
