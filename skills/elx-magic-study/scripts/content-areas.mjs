import { assert, hash, loadLibrary, saveLibrary } from './store.mjs';
import { Lark, feishuURL } from './lark.mjs';

export const areaHash = state => hash(state.contentAreas || null);
export const areaDepth = (state, trail) => Object.values(state.contentAreas || {}).some(r => r.node_token === trail[0]?.nodeToken) ? trail.length - 1 : trail.length;

export async function verifyAreas(state, lark) {
  for (const root of Object.values(state.contentAreas || {})) {
    await lark.inScope(root.url, [state.writeRoot]);
    const n = await lark.node(root.url);
    assert(n.node_token === root.node_token && String(n.space_id) === root.space_id && n.parent_node_token === state.writeRoot.node_token && n.title === root.title, 'CONTENT_AREAS_CHANGED', '资料分区身份、位置或名称变化，先重新核对绑定');
  }
}

export async function bindAreas(home, id, spec, supplied) {
  assert(spec.confirmed === true, 'CONFIRM_REQUIRED', '先确认两类资料分区的具体链接与范围');
  const state = await loadLibrary(home, id), lark = supplied || new Lark(state.profile);
  assert(state.provider === 'feishu' && state.writeRoot, 'WRITE_DISABLED', '需要已绑定的飞书首页');
  await lark.assertAccount(state);
  const roots = {};
  for (const key of ['links', 'personal']) {
    const parsed = feishuURL(spec[key]); await lark.inScope(parsed.url, [state.writeRoot]); const n = await lark.node(parsed.url);
    assert(parsed.kind === 'wiki' && parsed.origin === state.writeRoot.origin && String(n.space_id) === String(state.writeRoot.space_id) && n.parent_node_token === state.writeRoot.node_token, 'CONTENT_AREAS_SCOPE', '资料分区必须是已授权首页的两个直接子节点');
    roots[key] = { ...parsed, node_token: n.node_token, space_id: String(n.space_id), title: n.title };
  }
  assert(roots.links.node_token !== roots.personal.node_token, 'CONTENT_AREAS_SCOPE', '链接资料与个人记录不能绑定到同一节点');
  state.contentAreas = roots; await saveLibrary(home, state);
  return { configured: true, roots, remoteChanged: false, note: '只登记已核验分区；不创建、移动、改名或调整远端顺序。书屋管理最先展示由初始化／已确认整理清单完成。' };
}

export async function documentArea(state, lark, url) {
  if (!state.contentAreas) return undefined;
  const seen = new Set(); let n = await lark.node(url);
  while (n && !seen.has(n.node_token)) {
    seen.add(n.node_token);
    assert(String(n.space_id) === String(state.writeRoot.space_id), 'OUT_OF_SCOPE', '文档离开分区所属空间');
    for (const [key, r] of Object.entries(state.contentAreas)) if (n.node_token === r.node_token) return key;
    if (n.node_token === state.writeRoot.node_token || !n.parent_node_token) return null;
    assert(seen.size < 100, 'CONTENT_AREAS_SCOPE', '无法在有界范围内核对资料分区');
    n = await lark.node(`${state.writeRoot.origin}/wiki/${n.parent_node_token}`);
  }
  assert(!n, 'CONTENT_AREAS_SCOPE', '分区父路径出现循环，停止核对');
}
