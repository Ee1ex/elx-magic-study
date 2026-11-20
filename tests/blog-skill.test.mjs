import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const installer = path.join(root, 'scripts', 'install.mjs');
const blogSkill = 'elx-study-to-blog';
const studySkill = 'elx-magic-study';
async function install(home, ...args) {
  const { stdout } = await execute(process.execPath, [installer, ...args], { env: { ...process.env, CODEX_HOME: home } });
  return JSON.parse(stdout);
}
async function call(file, args) {
  const { stdout } = await execute(process.execPath, [file, ...args], { encoding: 'utf8' });
  return JSON.parse(stdout);
}

test('书屋转博客可单独预览和安装，重复安装保留改动，默认仍只装书屋', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'elx-blog-install-'));
  assert.equal((await install(home, '--skill', blogSkill)).state, 'preview');
  assert.deepEqual(await fs.readdir(home), []);
  await assert.rejects(install(home, '--skill', '../invalid', '--apply'));
  const target = path.join(home, 'skills', blogSkill);
  const firstInstalls = await Promise.all([install(home, '--skill', blogSkill, '--apply'), install(home, '--skill', blogSkill, '--apply')]);
  assert.deepEqual(firstInstalls.map(r => r.state).sort(), ['already-identical','installed']);
  assert.ok(firstInstalls.every(r => r.target === target));
  assert.deepEqual(await fs.readdir(path.dirname(target)), [blogSkill]);
  assert.equal((await install(home, '--skill', blogSkill, '--apply')).state, 'already-identical');
  const file = path.join(target, 'SKILL.md');
  await fs.appendFile(file, '\n本地个人修改\n');
  await assert.rejects(install(home, '--skill', blogSkill, '--apply'));
  assert.match(await fs.readFile(file, 'utf8'), /本地个人修改/);
  assert.equal((await install(home, '--apply')).target, path.join(home, 'skills', studySkill));
  assert.equal((await install(home, '--apply')).state, 'already-identical');
});

test('安装后的博客 Skill 从指定或并列的魔法书屋查找并回读同一篇资料', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'elx-blog-read-'));
  const state = path.join(home, 'synthetic-state');
  const common = ['--home', state, '--library', 'demo'];
  const { target } = await install(home, '--skill', blogSkill, '--apply');
  const reader = path.join(target, 'scripts', 'source.mjs');
  await assert.rejects(call(reader, ['fetch', '--id', 'example', ...common]), /STUDY_NOT_FOUND/);
  const sibling = (await install(home, '--apply')).target;
  const fixture = path.join(home, 'demo.json');
  await fs.writeFile(fixture, JSON.stringify({ demo:true, documents:[
    {id:'example', title:'合成的读书卡', markdown:'## 标记\n复习时核对原文。', coverage:'partial', url:'https://example.com/reading'},
    {id:'another', title:'另一篇合成资料', markdown:'主题页索引'}
  ] }));
  await call(path.join(sibling,'scripts','library.mjs'), ['demo-import','--home',state,'--id','demo','--file',fixture]);
  const hits = await call(reader,['search','--query','读书卡',...common]);
  assert.ok(hits.data.results.some(row=>row.id==='example'));
  const note = await call(reader,['fetch','--id','example','--study-root',sibling,...common]);
  assert.equal(note.data.markdown,'## 标记\n复习时核对原文。');
  assert.equal(note.data.coverage,'partial');
  await assert.rejects(call(reader,['apply',...common]), /READ_ONLY/);
  await assert.rejects(call(reader,['fetch','--id','missing',...common]), /UNKNOWN_DOCUMENT/);
});
