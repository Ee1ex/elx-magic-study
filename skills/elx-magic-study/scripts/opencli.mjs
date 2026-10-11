import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assert, issue } from './store.mjs';

export function resolveOpenCLI({ platform = process.platform, env = process.env } = {}) {
  if (platform !== 'win32') return { command: 'opencli', prefix: [] };
  for (const dir of (env.PATH || env.Path || '').split(path.delimiter).filter(Boolean)) {
    const exe = path.join(dir, 'opencli.exe');
    if (fs.existsSync(exe)) return { command: exe, prefix: [] };
    const cmd = path.join(dir, 'opencli.cmd'); if (!fs.existsSync(cmd)) continue;
    const shim = fs.readFileSync(cmd, 'utf8');
    const managed = /OPENCLIAPP_MANAGED_SHIM/.test(shim) && shim.match(/^\s*"([^"\r\n]+\.exe)"\s+__opencli_shim\s+%\*\s*$/mi);
    if (managed && path.isAbsolute(managed[1]) && fs.existsSync(managed[1])) return { command: managed[1], prefix: ['__opencli_shim'] };
    const root = path.join(dir, 'node_modules', '@jackwener', 'opencli'), manifest = path.join(root, 'package.json');
    if (fs.existsSync(manifest)) {
      const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8')), entry = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.opencli;
      if (pkg.name === '@jackwener/opencli' && typeof entry === 'string') {
        const target = path.resolve(root, entry), relative = path.relative(root, target);
        assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && fs.existsSync(target), 'OPENCLI_SHIM', 'OpenCLI包入口越界或缺失，先用OpenCLIApp修复，不执行cmd拼接');
        return { command: process.execPath, prefix: [target] };
      }
    }
    throw issue('OPENCLI_SHIM', '无法安全解析当前OpenCLI入口；请用OpenCLIApp检查CLI，保留原安装');
  }
  throw issue('OPENCLI_MISSING', '未找到OpenCLI；按reading-tools.md引导OpenCLIApp安装，不自动下载');
}

export function invokeOpenCLI(args, { target = resolveOpenCLI(), runner = spawnSync } = {}) {
  assert(Array.isArray(args) && args.every(a => typeof a === 'string' && !a.includes('\0')), 'ARGUMENT', 'OpenCLI参数必须是独立文字参数');
  return runner(target.command, [...target.prefix, ...args], { shell: false, windowsHide: true, encoding: 'utf8', timeout: 60000, maxBuffer: 24 * 1024 * 1024 });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = invokeOpenCLI(process.argv.slice(2));
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) throw issue('OPENCLI_EXEC', 'OpenCLI未正常完成；写操作先核实结果，不能盲目重发');
    process.exitCode = result.status ?? 1;
  } catch (e) { process.stderr.write(JSON.stringify({ ok: false, error: { code: e.code || 'ERROR', message: e.code ? e.message : 'OpenCLI入口配置无法解析，请检查安装' } }) + '\n'); process.exitCode = 1; }
}
