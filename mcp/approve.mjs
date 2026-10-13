#!/usr/bin/env node
import readline from 'node:readline/promises';
import { createApproval, inspectPlan, approvalHome } from './approval.mjs';

const [operationId, digest] = process.argv.slice(2);
if (!process.stdin.isTTY || !operationId || !digest) { console.error('请在本机交互式终端运行 node approve.mjs <operationId> <digest>'); process.exit(1); }
try {
  const { state, plan } = await inspectPlan(approvalHome(), process.env.ELX_MAGIC_STUDY_MCP_LIBRARY, operationId, true);
  if (plan.digest !== digest) throw new Error('摘要与当前计划不一致');
  console.log(JSON.stringify({ library: state.name, operationId, digest, purpose: plan.payload.purpose, actions: plan.payload.actions }, null, 2));
  const prompt = `批准 ${operationId} ${digest}`;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`核对完整目标与正文后，输入「${prompt}」：\n`);
  rl.close();
  if (answer !== prompt) throw new Error('未批准');
  console.log(JSON.stringify({ operationId, digest, approvalToken: await createApproval(approvalHome(), state.id, operationId, digest) }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
