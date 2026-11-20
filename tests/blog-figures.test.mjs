import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inspectFigures } from '../skills/elx-study-to-blog/scripts/check-figures.mjs';

const text = value => ({ type:'text', value });
const heading = (value, depth=2) => ({ type:'heading', depth, children:[text(value)] });
const image = (name, alt='展示两个对象的差别') => ({ type:'image', url:'/content/'+name, alt });
const root = (...children) => ({type:'root', children});

test('每个 H2 单独计数，封面、开场、代码和跨节重复字节不充当本节配图', async () => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'elx-figures-'));
  await fs.writeFile(path.join(dir,'a.webp'),'first');
  await fs.writeFile(path.join(dir,'copy.webp'),'first');
  await fs.writeFile(path.join(dir,'b.webp'),'second');
  const tree=root({type:'yaml',value:'cover: /content/a.webp'}, image('a.webp'),
    heading('比较'),heading('局部',3),image('a.webp'),heading('顺序'),
    {type:'code',value:'![例图](/content/b.webp)'},image('copy.webp'));
  let report=await inspectFigures(tree,dir);
  assert.deepEqual(report.sections.map(s=>s.independent),[1,0]);
  assert.equal(report.ok,false);
  assert.equal(report.sections[1].images[0].reusedFrom,'比较');
  tree.children.push({type:'paragraph',children:[{type:'imageReference',identifier:'diagram',alt:'两个步骤相连'}]},
    {type:'definition',identifier:'diagram',url:'/content/b.webp'});
  report=await inspectFigures(tree,dir);
  assert.equal(report.ok,true);
  assert.deepEqual(report.sections.map(s=>s.independent),[1,1]);
});

test('列出缺 alt、缺文件及非本站图片，不把说明文本当图', async () => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'elx-figures-invalid-'));
  await fs.writeFile(path.join(dir,'ok.webp'),'diagram');
  const report=await inspectFigures(root(heading('起点'),{type:'paragraph',children:[text('图注')]},
    image('ok.webp',' '),image('missing.webp'),{type:'image',url:'https://example.com/remote.png',alt:'远程图'},
    {type:'mdxJsxFlowElement',name:'img',attributes:[{name:'src',value:'/content/ok.webp'},{name:'alt',value:'本地说明图'}],children:[]}),dir);
  assert.equal(report.ok,false);
  assert.equal(report.sections[0].independent,1);
  assert.deepEqual(report.sections[0].images.filter(x=>x.error).map(x=>x.error),['EMPTY_ALT','MISSING_FILE','NOT_LOCAL']);
});

test('标题图标不能作为章节正文配图', async () => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'elx-figures-icons-'));
  await fs.writeFile(path.join(dir,'badge.webp'),'badge');
  const h2=heading('读图'),h3=heading('示例',3);
  h2.children.push(image('badge.webp','标记'));
  h3.children.push(image('badge.webp','标记'));
  const report=await inspectFigures(root(h2,h3),dir);
  assert.equal(report.ok,false);
  assert.equal(report.covered,0);
  assert.deepEqual(report.sections[0].images,[]);
});
