#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const version = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).version;
const destination = path.join(root, 'artifacts', `elx-magic-study-${version}`);
await fs.mkdir(path.dirname(destination), { recursive: true });
await fs.mkdir(destination, { recursive: false });
await fs.copyFile(path.join(root, 'package.json'), path.join(destination, 'package.json'));
const mcp = path.join(destination, 'mcp');
await fs.mkdir(mcp);
for (const name of ['package.json', 'package-lock.json', 'server.mjs', 'tools.mjs', 'runner.mjs', 'worker.mjs', 'approval.mjs', 'approve.mjs', 'README.md']) await fs.copyFile(path.join(root, 'mcp', name), path.join(mcp, name));
const skill = path.join(destination, 'skills', 'elx-magic-study');
await fs.mkdir(path.dirname(skill), { recursive: true });
await fs.cp(path.join(root, 'skills', 'elx-magic-study'), skill, { recursive: true, filter: source => !source.includes('__pycache__') && !source.endsWith('.pyc') });
const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
await fs.access(npmCli);
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [npmCli, 'ci', '--omit=dev', '--ignore-scripts'], { cwd: mcp, stdio: 'inherit', windowsHide: true });
  child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(`npm ci 退出 ${code}`)));
});
console.log(JSON.stringify({ version, destination, start: path.join(mcp, 'server.mjs') }));
