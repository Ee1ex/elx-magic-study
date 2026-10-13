#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import fs from 'node:fs';
import { registerStudyTools } from './tools.mjs';

const version = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
void serveStdio(() => {
  const server = new McpServer({ name: 'elx-magic-study', version });
  registerStudyTools(server);
  return server;
});
