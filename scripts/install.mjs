import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../skills/elx-magic-study');
const target = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'skills', 'elx-magic-study');
async function inventory(root, relative='') {const result=[];for(const item of await fs.readdir(path.join(root,relative),{withFileTypes:true})){const rel=path.join(relative,item.name);if(item.isSymbolicLink())throw new Error('安装包不能含符号链接');if(item.isDirectory())result.push(...await inventory(root,rel));else{const data=await fs.readFile(path.join(root,rel));result.push({file:rel,hash:createHash('sha256').update(data).digest('hex')});}}return result.sort((a,b)=>a.file.localeCompare(b.file));}
const files=await inventory(source);let exists=false;try{await fs.stat(target);exists=true}catch(e){if(e.code!=='ENOENT')throw e;}
if(exists){const installed=await inventory(target);if(JSON.stringify(installed)===JSON.stringify(files)){console.log(JSON.stringify({state:'already-identical',target,files:files.length}));process.exit(0)}throw new Error('目标已存在且内容不同；不覆盖。请先评审现有版本并明确升级范围。');}
if(!process.argv.includes('--apply')){console.log(JSON.stringify({state:'preview',source,target,files:files.length,note:'只有 --apply 才安装；不会安装飞书 CLI、修改账号或创建定时任务'},null,2));process.exit(0);}
await fs.mkdir(path.dirname(target),{recursive:true});
await fs.cp(source,target,{recursive:true,errorOnExist:true,force:false});
const installed=await inventory(target);if(JSON.stringify(installed)!==JSON.stringify(files))throw new Error('安装内容校验不一致，保留文件供检查');
console.log(JSON.stringify({state:'installed',target,files:files.length,verified:'all-file-sha256',next:'在新对话调用 $elx-magic-study 开始引导；宿主发现状态仍需刷新确认'},null,2));
