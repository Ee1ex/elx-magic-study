import { randomInt, randomUUID } from 'node:crypto';
import { assert, hash } from './store.mjs';
import { tableCells, verificationText } from './verification.mjs';
import { search } from './retrieval.mjs';

const key = value => value.normalize('NFKC').trim().toLowerCase();
const names = ['名称', '品名', '店名'];
const brands = ['品牌', '品牌/规格'];
const column = (headers, aliases) => headers.findIndex(h => aliases.includes(key(h)));
const personal = d => d.contentArea === 'personal' || (d.contentArea === undefined && d.kind === 'personal');
const separator = cells => cells?.every(c => /^:?-+:?$/.test(c));
export const rowMarkdown = values => '| ' + values.map(s => s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|')).join(' | ') + ' |';
export const tableHash = table => hash({ id: table.id, headers: table.headers, rows: table.rows, cells: table.cells });

export function markdownTables(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n'), tables = []; let heading = '', fence = null;
  for (let i = 0; i < lines.length; i++) {
    const marker = lines[i].match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) { if (!fence) fence = marker[1]; else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null; continue; }
    if (fence || /^( {4}|\t)/.test(lines[i])) continue;
    if (/^#{1,6}\s/.test(lines[i])) heading = lines[i].replace(/^#+\s*/, '');
    const headers = tableCells(lines[i])?.map(h => h.replace(/^(\*\*|__|`)(.*)\1$/, '$2')), divider = tableCells(lines[i + 1] || '');
    if (!headers || !separator(divider) || headers.length !== divider.length) continue;
    const start = i, rows = []; i += 2;
    while (i < lines.length) { const row = tableCells(lines[i]); if (!row || row.length !== headers.length) break; rows.push(row); i++; }
    tables.push({ heading, headers, rows, start, end: i }); i--;
  }
  return { lines, tables };
}

export function nativeTable(blocks, tableId) {
  const byId = new Map(blocks.map(b => [b.block_id, b])), b = byId.get(tableId), property = b?.table?.property;
  const unmerged = property?.merge_info === undefined || (Array.isArray(property.merge_info) && property.merge_info.every(cell => cell?.row_span === 1 && cell?.col_span === 1));
  assert(b?.block_type === 31 && Number.isInteger(property?.column_size) && Number.isInteger(property.row_size) && property.row_size >= 1 && property.column_size >= 2 && unmerged, 'RECORD_TABLE', '需要有表头、未合并单元格的原生文档表格');
  const cells = b.table.cells;
  assert(Array.isArray(cells) && cells.length === property.row_size * property.column_size, 'RECORD_TABLE', '表格单元格列表不完整');
  const textIds = [], values = cells.map(id => {
    const cell = byId.get(id); assert(cell?.block_type === 32 && Array.isArray(cell.children), 'RECORD_TABLE', '缺少单元格结构');
    textIds.push(cell.children.length === 1 && byId.get(cell.children[0])?.block_type === 2 ? cell.children[0] : null);
    return cell.children.map(child => {
      const p = byId.get(child); assert(p?.block_type === 2 && Array.isArray(p.text?.elements), 'RECORD_RICH_CELL', '复杂单元格保留原样，请按官方块编辑流程另作预览');
      return p.text.elements.map(e => {
        assert(typeof e.text_run?.content === 'string', 'RECORD_RICH_CELL', '资源、公式和引用单元格不能作为普通记录表格处理');
        const t = e.text_run, url = t.text_element_style?.link?.url;
        return url ? `[${t.content}](${decodeURIComponent(url)})` : t.content;
      }).join('');
    }).join('\n');
  });
  const rows = []; for (let i = property.column_size; i < values.length; i += property.column_size) rows.push(values.slice(i, i + property.column_size));
  return { id: tableId, headers: values.slice(0, property.column_size), rows, cells, textIds };
}

export function prepareRecord(document, table, fields) {
  assert(fields && typeof fields === 'object' && !Array.isArray(fields) && Object.keys(fields).length, 'RECORD_FIELDS', '提供按当前表头填写的条目字段');
  assert(new Set(table.headers.map(key)).size === table.headers.length, 'RECORD_SCHEMA', '表头重复，先核对');
  const name = column(table.headers, names), brand = column(table.headers, brands);
  assert(name >= 0, 'RECORD_SCHEMA', '需要能确认名称／品名／店名的表头；其他列沿用现有结构，不强制补齐品牌或备注列');
  for (const [k, v] of Object.entries(fields)) assert(table.headers.includes(k) && typeof v === 'string' && !/[\r\n]/.test(v) && v.length <= 4000, 'RECORD_FIELDS', '字段需对应现有列且为单行文本；新增列先预览，其他信息可保留到备注');
  const values = table.headers.map(h => fields[h] || ''); assert(values[name].trim(), 'RECORD_NAME', '名称必填；品牌和备注没有信息时可空');
  assert(!table.rows.some(r => key(r[name]) === key(values[name]) && key(r[brand] || '') === key(values[brand] || '')), 'DUPLICATE_RECORD', '同名同品牌条目已存在；先读取原备注，明确补充范围，不创建副本');
  const parsed = markdownTables(document.markdown), equal = (a, b) => hash(a.map(r => r.map(verificationText))) === hash(b.map(r => r.map(verificationText)));
  const matches = parsed.tables.filter(t => equal([t.headers, ...t.rows], [table.headers, ...table.rows]));
  assert(matches.length === 1, 'RECORD_TABLE_AMBIGUOUS', '原生表格与正文不能唯一对应，停止而不在文末追加伪表格');
  const content = rowMarkdown(values); parsed.lines.splice(matches[0].end, 0, content);
  return { fields, values, content, tableId: table.id, tableHash: tableHash(table), expectedTextHash: hash(verificationText(parsed.lines.join('\n'))), nativeTokens: { insert: randomUUID(), fill: randomUUID(), cells: values.map(() => randomUUID()) } };
}

export function recordContext(documents, id) {
  const d = documents.find(d => d.id === id && !d.unavailable && !d.outOfScope && personal(d));
  assert(d, 'RECORD_DOCUMENT', '请先读取并核对个人记录区内的文档');
  return { id: d.id, title: d.title, url: d.url, cached: true, fetchedAt: d.fetchedAt, tables: markdownTables(d.markdown).tables.map((t, index) => ({ index, heading: t.heading, headers: t.headers, rows: t.rows, count: t.rows.length, missing: Object.fromEntries(t.headers.map((h, i) => [h, t.rows.filter(r => !r[i].trim()).length])) })), note: '这里只提供现状；Agent结合内容规模、重复信息和推荐需求建议新增列，不设固定条数，不自动扩列或回填。写入前取得原生tableId。' };
}

export function searchRecords(documents, queries, { limit = 8, filters = {}, random = false, eligibleIds } = {}) {
  assert(Number.isInteger(limit) && limit >= 1 && limit <= 50 && filters && typeof filters === 'object' && !Array.isArray(filters) && Object.values(filters).every(v => typeof v === 'string' && v.trim()), 'RECORD_FILTER', '数量为1—50，筛选使用非空字段文本');
  let entries = documents.filter(d => !d.unavailable && !d.outOfScope && personal(d)).flatMap(d => markdownTables(d.markdown).tables.flatMap((t, tableIndex) => {
    const name = column(t.headers, names); if (name < 0 || new Set(t.headers).size !== t.headers.length) return [];
    return t.rows.flatMap((r, rowIndex) => r[name].trim() ? [{ id: hash([d.id, d.hash, tableIndex, rowIndex, r]).slice(0, 24), documentId: d.id, title: d.title, url: d.url, heading: t.heading, tableIndex, rowIndex, fields: Object.fromEntries(t.headers.map((h, i) => [h, r[i]])), fetchedAt: d.fetchedAt, documentHash: d.hash }] : []);
  }));
  entries = entries.filter(e => Object.entries(filters).every(([k, v]) => e.fields[k]?.normalize('NFKC').includes(v.normalize('NFKC'))));
  if (queries.some(q => q.trim())) { const ranked = search(entries.map(e => ({ id: e.id, title: e.title + ' ' + e.heading, markdown: Object.values(e.fields).join(' ') })), queries, { limit: entries.length || 1, expand: false }); const map = new Map(entries.map(e => [e.id, e])); entries = ranked.results.map(r => ({ ...map.get(r.id), score: r.score })); }
  if (eligibleIds !== undefined) { assert(Array.isArray(eligibleIds) && eligibleIds.every(id => entries.some(e => e.id === id)), 'RECORD_CANDIDATES_CHANGED', '合格条目池与当前候选不符，先重新核对条件'); entries = entries.filter(e => eligibleIds.includes(e.id)); }
  const count = entries.length, selected = [];
  if (random) { const pool = [...entries]; while (pool.length && selected.length < limit) selected.push(pool.splice(randomInt(pool.length), 1)[0]); }
  else selected.push(...entries.slice(0, limit));
  return { cached: true, mode: random ? 'random-from-candidates' : 'record-search', eligibleCount: count, results: selected, note: '字段筛选是文本匹配，不证明低卡、价格或体验；先回读核对语义条件，再用eligibleIds限定随机池。此结果未联网搜索。' };
}
