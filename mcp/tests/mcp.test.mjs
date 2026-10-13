import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { McpServer } from '@modelcontextprotocol/server';
import { importManifest } from '../../skills/elx-magic-study/scripts/library-core.mjs';
import { runWorker } from '../runner.mjs';
import { createApproval, consumeApproval } from '../approval.mjs';
import { libraryPath, writeJSON } from '../../skills/elx-magic-study/scripts/store.mjs';
import { registerStudyTools } from '../tools.mjs';

const serverPath = process.env.ELX_MAGIC_STUDY_TEST_SERVER || fileURLToPath(new URL('../server.mjs', import.meta.url));
const root = fileURLToPath(new URL('../../artifacts/test-runs/mcp/', import.meta.url));
const fixture = async () => {
  await fs.mkdir(root, { recursive: true });
  const home = await fs.mkdtemp(path.join(root, 'synthetic-'));
  await importManifest(home, 'demo', { demo: true, name: '合成书屋', documents: [{ id: 'note', title: '中文检索样本', kind: 'topic', url: 'https://example.com/note', markdown: '# 中文检索样本\n这是合成正文。' }] });
  return home;
};

test('官方客户端完成 stdio 握手、工具发现和合成检索', async () => {
  const home = await fixture();
  const client = new Client({ name: 'magic-study-test', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath], env: { ...process.env, ELX_MAGIC_STUDY_MCP_HOME: home, ELX_MAGIC_STUDY_MCP_LIBRARY: 'demo' }, stderr: 'pipe' });
  await client.connect(transport);
  try {
    const names = (await client.listTools()).tools.map(t => t.name);
    assert(names.includes('study_status') && names.includes('study_apply') && names.includes('study_recover'));
    const status = await client.callTool({ name: 'study_status', arguments: {} });
    assert.equal(status.isError, undefined);
    assert.equal(status.structuredContent.data.indexed, 1);
    const found = await client.callTool({ name: 'study_search', arguments: { query: ['中文检索'], offline: true } });
    assert.equal(found.isError, undefined);
    assert.match(JSON.stringify(found.structuredContent), /中文检索样本/);
    const bad = await client.callTool({ name: 'study_fetch', arguments: { documentId: '../outside' } });
    assert.equal(bad.isError, true);
    const noApproval = await client.callTool({ name: 'study_apply', arguments: { operationId: 'missing', digest: 'a'.repeat(64), approvalToken: '00000000-0000-4000-8000-000000000000' } });
    assert.equal(noApproval.isError, true);
  } finally { await client.close(); }
});

test('worker 固定映射拒绝任意命令和未核实随机候选', async () => {
  await assert.rejects(runWorker({ action: 'shell', args: { command: 'whoami' } }), e => e.code === 'UNSUPPORTED');
  await assert.rejects(runWorker({ action: 'record-search', args: { random: true } }), e => e.code === 'ELIGIBLE_IDS_REQUIRED');
});

test('慢工具调用时协议仍能响应另一个状态请求', async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: 'synthetic', version: '1.0.0' });
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  registerStudyTools(server, async request => request.action === 'search' ? blocked : { ready: true });
  const client = new Client({ name: 'synthetic-client', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const slow = client.callTool({ name: 'study_search', arguments: { query: ['合成'] } });
    const fast = await client.callTool({ name: 'study_status', arguments: {} });
    assert.equal(fast.structuredContent.data.ready, true);
    release({ found: true });
    assert.equal((await slow).structuredContent.data.found, true);
  } finally { await client.close(); await server.close(); }
});

test('计划批准绑定摘要、账号和写入根，一次消费不可重放', async () => {
  const home = await fixture();
  const file = path.join(libraryPath(home, 'demo'), 'library.json');
  const state = JSON.parse(await fs.readFile(file, 'utf8'));
  state.account = 'synthetic-account';
  state.writeRoot = { url: 'https://example.com/root', node_token: 'synthetic-root' };
  await writeJSON(file, state);
  const operationId = 'synthetic-plan';
  const digest = 'a'.repeat(64);
  await writeJSON(path.join(libraryPath(home, 'demo'), 'operations', operationId + '.json'), { state: 'preview', digest, payload: { operation: operationId, library: 'demo', account: state.account, writeRoot: state.writeRoot, purpose: '合成测试', actions: [{ kind: 'append', content: '合成正文' }] } });
  const token = await createApproval(home, 'demo', operationId, digest);
  await assert.rejects(consumeApproval(home, 'demo', operationId, digest, 'wrong'), e => e.code === 'APPROVAL_MISMATCH');
  await consumeApproval(home, 'demo', operationId, digest, token);
  await assert.rejects(consumeApproval(home, 'demo', operationId, digest, token), e => e.code === 'APPROVAL_USED');
});

test('两步计划仅在前一步已核验且后一步待发送时可沿用原批准', async () => {
  const home = await fixture();
  const file = path.join(libraryPath(home, 'demo'), 'library.json');
  const state = JSON.parse(await fs.readFile(file, 'utf8'));
  state.account = 'synthetic-account'; state.writeRoot = { url: 'https://example.com/root', node_token: 'synthetic-root' };
  await writeJSON(file, state);
  const operationId = 'two-steps', digest = 'b'.repeat(64);
  const planFile = path.join(libraryPath(home, 'demo'), 'operations', operationId + '.json');
  const plan = { state: 'preview', digest, payload: { operation: operationId, library: 'demo', account: state.account, writeRoot: state.writeRoot, actions: [{ kind: 'create' }, { kind: 'create' }] }, steps: [{ state: 'pending' }, { state: 'pending' }] };
  await writeJSON(planFile, plan);
  const token = await createApproval(home, 'demo', operationId, digest);
  await consumeApproval(home, 'demo', operationId, digest, token);
  plan.state = 'incomplete'; plan.steps[0].state = 'verified';
  await writeJSON(planFile, plan);
  await consumeApproval(home, 'demo', operationId, digest, token);
  plan.steps[1].state = 'unknown';
  await writeJSON(planFile, plan);
  await assert.rejects(consumeApproval(home, 'demo', operationId, digest, token), e => e.code === 'APPROVAL_USED');
});
