import { randomUUID } from 'node:crypto';
import { assert, hash, now, saveLibrary } from './store.mjs';

// Directory work and body reads have separate durable queues. A fetched page is
// saved before consuming its items, so stopping inside a page loses no entries.
export async function scanCatalog(home, state, lark, { maxNodes, force, restartScan }) {
  for (const root of state.readRoots.filter(r => r.kind === 'wiki')) {
    const fresh = await lark.node(root.url);
    assert(fresh.node_token === root.node_token && String(fresh.space_id) === String(root.space_id), 'ROOT_CHANGED', '读取根身份变化，请核对绑定；未沿用扫描断点');
  }
  const binding = hash({ account: state.account, roots: state.readRoots });
  const previous = state.scan;
  const reset = previous && previous.binding !== binding ? 'binding_changed' : restartScan ? 'requested' : null;
  if (!previous || reset || (previous.complete && !previous.pendingReads.length)) {
    state.scan = { schemaVersion: 1, id: randomUUID(), binding, startedAt: now(), force: !!force,
      queue: state.readRoots.map(root => ({ type: 'root', root })), pages: [], seen: [], catalog: [], pendingReads: [], complete: false };
  }
  const scan = state.scan;
  if (force) scan.force = true;
  await saveLibrary(home, state);
  let nodes = 0, pages = 0;
  function document(n, url, origin) {
    if (scan.catalog.some(d => d.id === n.obj_token)) return;
    assert(n.obj_token, 'NODE_FORMAT', '目录文档缺少编号');
    scan.catalog.push({ id: n.obj_token, url, title: n.title || n.obj_token, origin,
      remoteEditTime: /^\d+$/.test(String(n.obj_edit_time || '')) ? String(n.obj_edit_time) : null });
    scan.pendingReads.push(n.obj_token);
  }
  try {
    while (scan.queue.length && nodes < maxNodes && pages < 100) {
      const task = scan.queue[0];
      if (task.type === 'root') {
        const root = task.root;
        if (root.kind === 'docx') document({ obj_token: root.documentId, title: root.title }, root.url, root.origin);
        else {
          const n = await lark.node(root.url);
          assert(n.node_token === root.node_token && String(n.space_id) === String(root.space_id), 'ROOT_CHANGED', '读取根身份变化，核对绑定后重启扫描');
          if (n.obj_type === 'docx') document(n, root.url, root.origin);
          scan.seen.push(n.node_token);
          scan.queue.push({ type: 'page', parent: { ...n, origin: root.origin }, url: root.url });
        }
        scan.queue.shift(); nodes++;
      } else if (task.type === 'page') {
        await lark.inScope(task.url, state.readRoots);
        const key = task.parent.node_token + ':' + (task.token || '');
        assert(!scan.pages.includes(key), 'PAGINATION', '目录分页游标重复，请 --restart-scan 重建目录断点');
        const page = await lark.children(task.parent, task.token); pages++;
        assert(Array.isArray(page.items) && (!page.has_more || (page.page_token && page.page_token !== task.token)), 'PAGINATION', '分页游标无效，请 --restart-scan 重建目录断点');
        scan.pages.push(key); scan.queue.shift();
        scan.queue.unshift({ type: 'items', parent: task.parent, items: page.items, offset: 0 });
        if (page.has_more) scan.queue.push({ ...task, token: page.page_token });
      } else {
        while (task.offset < task.items.length && nodes < maxNodes) {
          const n = task.items[task.offset]; assert(n.node_token, 'NODE_FORMAT', '子节点缺少稳定编号');
          const url = `${task.parent.origin}/wiki/${n.node_token}`;
          if (!scan.seen.includes(n.node_token)) {
            scan.seen.push(n.node_token);
            if (n.obj_type === 'docx') document(n, url, task.parent.origin);
            if (n.has_child) scan.queue.push({ type: 'page', parent: { ...n, space_id: n.space_id || task.parent.space_id, origin: task.parent.origin }, url });
          }
          task.offset++; nodes++;
        }
        if (task.offset === task.items.length) scan.queue.shift();
      }
      await saveLibrary(home, state);
    }
    scan.complete = scan.queue.length === 0; scan.lastError = null;
    await saveLibrary(home, state);
    return { scan, reset };
  } catch (e) {
    scan.lastError = { code: e.code || 'ERROR', at: now() }; await saveLibrary(home, state); throw e;
  }
}
