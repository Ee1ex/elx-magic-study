import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importManifest } from '../skills/elx-magic-study/scripts/library-core.mjs';
import { loadLibrary } from '../skills/elx-magic-study/scripts/store.mjs';
import { search } from '../skills/elx-magic-study/scripts/retrieval.mjs';
import { exportGraph } from '../skills/elx-magic-study/scripts/graph.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = new Date().toISOString().replace(/[:.]/g,'-');
const output = path.join(project, 'artifacts', 'demo', run);
const manifest = {
  demo: true, name: '魔法书屋 · 合成资料演示',
  documents: [
    {id:'knowledge',kind:'topic',title:'Agent 知识管理',summary:'来源保留、主题综合、项目检索与持续维护。',url:'https://example.com/knowledge',markdown:'# Agent 知识管理\n先保留[原始资料](https://example.com/source)，再[整理为主题](https://example.com/topic)。通过[检索](https://example.com/search)帮助新项目，并[定时检查](https://example.com/maintenance)。'},
    {id:'source',kind:'source',title:'原始资料与来源笔记',summary:'记录文章、视频和文档的读取范围。',url:'https://example.com/source',markdown:'# 来源笔记\n保存出处和实际读取范围。视频见[字幕边界](https://example.com/video)。整理后关联[主题页](https://example.com/topic)。'},
    {id:'topic',kind:'topic',title:'持续更新主题页',summary:'同一主题综合多份资料，保留不同观点与适用条件。',url:'https://example.com/topic',markdown:'# 主题页\n主题需要[来源依据](https://example.com/source)，也需要[实践结果](https://example.com/experience)。'},
    {id:'search',kind:'topic',title:'中文本地增强检索',summary:'中文分词、BM25 排序、引用邻居，再由 Agent 阅读判断。',url:'https://example.com/search',markdown:'# 本地检索\n用中文分词检索正文，找到[主题](https://example.com/topic)并结合[项目条件](https://example.com/project)。断网时可以在明确接受历史快照后查询缓存。'},
    {id:'video',kind:'source',title:'视频字幕的读取边界',summary:'只有字幕不能声称核对过画面；缺失部分必须说明。',url:'https://example.com/video',coverage:'transcript',markdown:'# 视频资料\n[来源笔记](https://example.com/source)注明获取了哪些字幕，哪些画面未核对。'},
    {id:'experience',kind:'experience',title:'一次离线查询的实践记录',summary:'合成例子：保留缓存查询的时效范围，不冒充实时结果。',url:'https://example.com/experience',markdown:'# 实践记录（合成）\n在断网场景使用[本地检索](https://example.com/search)。记录验证条件，再补回[主题](https://example.com/topic)。'},
    {id:'project',kind:'document',title:'新项目中的参考建议',summary:'说明可复用、需调整、不适用与知识缺口。',url:'https://example.com/project',markdown:'# 项目参考\n结合[主题知识](https://example.com/topic)和[实践经验](https://example.com/experience)给出有依据的建议。'},
    {id:'maintenance',kind:'topic',title:'定时整理与只读检查',summary:'增量更新本地索引，生成草稿，重要变化才通知。',url:'https://example.com/maintenance',markdown:'# 定时维护\n检查[来源](https://example.com/source)变化与[主题](https://example.com/topic)引用，不自动执行远端改写。'}
  ]
};
const stateDir = path.join(output, 'state');
await importManifest(stateDir, 'demo', manifest);
const state = await loadLibrary(stateDir, 'demo');
const graph = await exportGraph(state.documents, path.join(output, 'knowledge-graph.html'), { title: manifest.name, demo: true });
await fs.writeFile(path.join(output, 'search-example.json'), JSON.stringify(search(state.documents, ['断网 缓存','离线 检索']), null, 2));
console.log(JSON.stringify({demo:true, output, stateHome:stateDir, ...graph},null,2));
