#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const usage = 'node check-figures.mjs <博客根目录> <相对博客根目录或绝对的稿件.mdx>';

function walk(node, visit) {
  if (visit(node) === false) return;
  for (const child of node.children || []) walk(child, visit);
}

function labelOf(node) {
  return node.value || node.alt || (node.children || []).map(labelOf).join('');
}

function staticImage(node, definitions) {
  if (node.type === 'image') return { url:node.url, alt:node.alt };
  if (node.type === 'imageReference') return { url:definitions.get(node.identifier), alt:node.alt };
  if (node.name === 'img' && ['mdxJsxTextElement','mdxJsxFlowElement'].includes(node.type)) {
    const attr = key => node.attributes.find(a => a.name === key && typeof a.value === 'string')?.value;
    return { url:attr('src'), alt:attr('alt') };
  }
}

function isChild(directory, file) {
  const within = path.relative(directory, file);
  return Boolean(within) && within !== '..' && !within.startsWith('..' + path.sep) && !path.isAbsolute(within);
}

async function imageIdentity(image, directory) {
  if (!image.alt?.trim()) return { error:'EMPTY_ALT' };
  if (!image.url?.startsWith('/content/')) return { error:'NOT_LOCAL' };
  try {
    const relative = decodeURIComponent(image.url.slice('/content/'.length));
    const candidate = path.resolve(directory, relative);
    if (!isChild(directory, candidate)) return { error:'NOT_LOCAL' };
    const file = await fs.realpath(candidate);
    if (!isChild(directory, file)) return { error:'NOT_LOCAL' };
    if (!(await fs.stat(file)).isFile()) return { error:'MISSING_FILE' };
    const bytes = await fs.readFile(file);
    if (!bytes.length) return { error:'EMPTY_FILE' };
    return { digest:createHash('sha256').update(bytes).digest('hex') };
  } catch (error) {
    if (['ENOENT','ENOTDIR'].includes(error.code)) return { error:'MISSING_FILE' };
    if (error instanceof URIError) return { error:'INVALID_URL' };
    throw error;
  }
}

export async function inspectFigures(tree, directory) {
  const contentRoot = await fs.realpath(directory);
  const definitions = new Map();
  walk(tree, node => {
    if (node.type === 'definition' && !definitions.has(node.identifier)) definitions.set(node.identifier, node.url);
  });
  const sections = [];
  walk(tree, node => {
    if (node.type === 'heading' || /^h[1-6]$/.test(node.name || '')) {
      if (node.depth === 2 || node.name === 'h2') sections.push({ heading:labelOf(node), independent:0, images:[] });
      return false;
    }
    if (sections.length) {
      const image = staticImage(node, definitions);
      if (image) sections.at(-1).images.push(image);
    }
  });
  const owners = new Map();
  for (const section of sections) {
    for (const image of section.images) {
      const {digest, error} = await imageIdentity(image, contentRoot);
      if (error) image.error = error;
      else if (owners.has(digest)) image.reusedFrom = owners.get(digest);
      else {
        owners.set(digest, section.heading);
        section.independent++;
      }
    }
  }
  const covered = sections.filter(s => s.independent > 0).length;
  return { ok:sections.length > 0 && covered === sections.length && sections.every(s => s.images.every(i => !i.error)), covered, total:sections.length, sections };
}

async function check(blog, draft) {
  const project = path.resolve(blog);
  const requireBlog = createRequire(path.join(project,'package.json'));
  const requireLoader = createRequire(requireBlog.resolve('@mdx-js/loader'));
  const {createProcessor} = await import(pathToFileURL(requireLoader.resolve('@mdx-js/mdx')).href);
  const plugins = await Promise.all(['remark-frontmatter','remark-gfm'].map(async name =>
    (await import(pathToFileURL(requireBlog.resolve(name)).href)).default));
  const markdown = await fs.readFile(path.resolve(project,draft),'utf8');
  const tree = createProcessor({ format:'mdx', remarkPlugins:plugins }).parse(markdown);
  return inspectFigures(tree,path.join(project,'public','content'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2) throw new Error(usage);
    const report = await check(...args);
    console.log(JSON.stringify(report,null,2));
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error.code === 'MODULE_NOT_FOUND' ? '请在目标博客按锁文件安装依赖，再运行配图检查。' : error.message);
    process.exitCode = 1;
  }
}
