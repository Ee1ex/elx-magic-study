#!/usr/bin/env node
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const usage = 'node source.mjs search --query <关键词> | fetch --id <书屋索引编号> [--study-root <魔法书屋目录>] [--library <库编号>] [--home <个人状态目录>] [--offline]';

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    'study-root': { type:'string' }, home: { type:'string' }, library: { type:'string' },
    query: { type:'string', multiple:true }, id: { type:'string' }, limit: { type:'string' },
    offline: { type:'boolean' }, help: { type:'boolean' }
  } });
  if (values.help) return { usage };
  const [command] = positionals;
  if (positionals.length !== 1 || !['search','fetch'].includes(command)) {
    throw Object.assign(new Error(usage), { code:'READ_ONLY' });
  }
  const argv = [command];
  if (command === 'search') {
    if (!values.query?.length || values.id) throw new Error(usage);
    for (const query of values.query) argv.push('--query', query);
    if (values.limit) argv.push('--limit', values.limit);
  } else {
    if (!values.id || values.query || values.limit) throw new Error(usage);
    argv.push('--id', values.id);
  }
  if (values.library) argv.push('--library', values.library);
  if (values.home) argv.push('--home', values.home);
  if (values.offline) argv.push('--offline');

  const root = values['study-root'] || fileURLToPath(new URL('../../elx-magic-study/', import.meta.url));
  const entry = path.resolve(root, 'scripts', 'library.mjs');
  try {
    await access(entry);
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    throw Object.assign(new Error('请用 --study-root 指向已有魔法书屋的 Skill 目录，或并列安装魔法书屋。'), { code:'STUDY_NOT_FOUND' });
  }
  const { run } = await import(pathToFileURL(entry).href);
  const data = await run(argv);
  if (command === 'search') return { results: data.results.map(({ id, title, coverage, matchType }) => ({ id, title, coverage, matchType })) };
  const { id, title, markdown, coverage, fetchedAt, revision, url, sourceUrl, captureNote, sourceNote, mode, demo } = data;
  return { id, title, markdown, coverage, fetchedAt, revision, url, sourceUrl, captureNote, sourceNote, mode, demo };
}

try {
  console.log(JSON.stringify({ ok:true, data:await main() }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok:false, error:{ code:error.code || 'INPUT', message:error.message } }));
  process.exitCode = 1;
}
