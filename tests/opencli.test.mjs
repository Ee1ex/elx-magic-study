import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

test('REQ-018 OpenCLIApp入口解析并直接传参，签名URL中的&不会进入shell', async () => {
  const {resolveOpenCLI,invokeOpenCLI}=await import('../skills/elx-magic-study/scripts/opencli.mjs');
  const dir=path.resolve('artifacts/test-runs/opencli',randomUUID());await fs.mkdir(dir,{recursive:true});
  const exe=path.join(dir,'OpenCLI App.exe');await fs.writeFile(exe,'synthetic');
  await fs.writeFile(path.join(dir,'opencli.cmd'),`@echo off\nREM OPENCLIAPP_MANAGED_SHIM\n"${exe}" __opencli_shim %*\n`);
  const target=resolveOpenCLI({platform:'win32',env:{PATH:dir}});assert.equal(target.command,exe);assert.deepEqual(target.prefix,['__opencli_shim']);
  const signed='https://example.com/note?xsec_token=a%2Bb=&source=pc&x=1';let calls=0;
  const r=invokeOpenCLI(['xiaohongshu','comments',signed],{target,runner:(command,args,options)=>{calls++;assert.equal(command,exe);assert.deepEqual(args,['__opencli_shim','xiaohongshu','comments',signed]);assert.equal(options.shell,false);return {status:0,stdout:'[]',stderr:''};}});
  assert.equal(r.status,0);assert.equal(calls,1);
});

test('REQ-018 未知cmd入口拒绝执行，npm入口只运行包内bin', async () => {
  const {resolveOpenCLI}=await import('../skills/elx-magic-study/scripts/opencli.mjs');
  const dir=path.resolve('artifacts/test-runs/opencli',randomUUID());await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'opencli.cmd'),'@echo off\nunknown %*');
  assert.throws(()=>resolveOpenCLI({platform:'win32',env:{PATH:dir}}),e=>e.code==='OPENCLI_SHIM');
  const pkg=path.join(dir,'node_modules/@jackwener/opencli');await fs.mkdir(pkg,{recursive:true});await fs.writeFile(path.join(pkg,'package.json'),JSON.stringify({name:'@jackwener/opencli',bin:{opencli:'cli.js'}}));await fs.writeFile(path.join(pkg,'cli.js'),'// synthetic');
  const target=resolveOpenCLI({platform:'win32',env:{PATH:dir}});assert.equal(target.command,process.execPath);assert.deepEqual(target.prefix,[path.join(pkg,'cli.js')]);
  await fs.writeFile(path.join(pkg,'package.json'),JSON.stringify({name:'@jackwener/opencli',bin:{opencli:'../../escape.js'}}));assert.throws(()=>resolveOpenCLI({platform:'win32',env:{PATH:dir}}),e=>e.code==='OPENCLI_SHIM');
});
