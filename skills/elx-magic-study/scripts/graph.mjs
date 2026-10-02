import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { writeNew } from './store.mjs';
import { graphData } from './retrieval.mjs';

export async function graphHTML(documents, options = {}) {
  const data = graphData(documents, options);
  const template = await fs.readFile(fileURLToPath(new URL('../assets/graph.html', import.meta.url)), 'utf8');
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return { data, html: template.replace('__ELX_GRAPH_DATA__', () => json) };
}
export async function exportGraph(documents, output, options) {
  const { data, html } = await graphHTML(documents, options);
  await writeNew(output, html);
  return { file: output, nodes: data.nodes.length, edges: data.edges.length, omitted: data.omitted, unresolved: data.unresolved.length, demo: data.demo, note: data.note };
}
