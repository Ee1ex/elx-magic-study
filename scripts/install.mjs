import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { skill: { type: 'string', default: 'elx-magic-study' }, apply: { type: 'boolean' } } });
const skill = values.skill;
if (!['elx-magic-study', 'elx-study-to-blog'].includes(skill)) throw new Error('请选择 elx-magic-study 或 elx-study-to-blog');
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../skills', skill);
const codexDirectory = path.resolve(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'));
const target = path.join(codexDirectory, 'skills', skill);
async function inventory(root, relative='') {const result=[];for(const item of await fs.readdir(path.join(root,relative),{withFileTypes:true})){const rel=path.join(relative,item.name);if(item.isSymbolicLink())throw new Error('安装包不能含符号链接');if(item.isDirectory())result.push(...await inventory(root,rel));else{const data=await fs.readFile(path.join(root,rel));result.push({file:rel,hash:createHash('sha256').update(data).digest('hex')});}}return result.sort((a,b)=>a.file.localeCompare(b.file));}
const files = await inventory(source);
const expected = JSON.stringify(files);
async function alreadyInstalled() {
  try {
    if (!(await fs.lstat(target)).isDirectory()) throw new Error('安装目标不是普通目录');
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  if (JSON.stringify(await inventory(target)) !== expected) throw new Error('目标已存在且内容不同；请先评审现有版本并明确升级范围。');
  return true;
}

if (await alreadyInstalled()) {
  console.log(JSON.stringify({ state:'already-identical', target, files:files.length }));
} else if (!values.apply) {
  console.log(JSON.stringify({ state:'preview', source, target, files:files.length, note:'加 --apply 安装选定的 Skill' },null,2));
} else {
  await fs.mkdir(path.dirname(target), { recursive:true });
  const staging = await fs.mkdtemp(path.join(codexDirectory, '.' + skill + '-install-'));
  await fs.cp(source, staging, { recursive:true, force:false });
  if (JSON.stringify(await inventory(staging)) !== expected) throw new Error('安装副本校验失败，保留于 ' + staging);
  try {
    await fs.rename(staging, target);
  } catch (error) {
    if (!(await alreadyInstalled())) throw error;
    console.log(JSON.stringify({ state:'already-identical', target, files:files.length, staging }));
    process.exit(0);
  }
  console.log(JSON.stringify({ state:'installed', target, files:files.length, verified:'all-file-sha256', next:'在新对话调用 $' + skill },null,2));
}
