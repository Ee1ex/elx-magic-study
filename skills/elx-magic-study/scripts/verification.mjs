import { hash } from './store.mjs';

// Keep the legacy normalizer for hashes already recorded in old plans.
export function normalizeText(s) { return s.normalize('NFKC').replace(/\\([\[\]_*~`|$<>])/g, '$1').replace(/[#*`_\s]/g, ''); }

export function tableCells(line) {
  const text = line.trim(); if (!text.includes('|')) return null;
  const cells = []; let cell = '', code = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\' && i + 1 < text.length) { cell += c + text[++i]; continue; }
    if (c === '`') {
      let ticks = c; while (text[i + 1] === '`') { ticks += '`'; i++; }
      if (!code) code = ticks; else if (code === ticks) code = '';
      cell += ticks; continue;
    }
    if (c === '|' && !code) { cells.push(cell.trim()); cell = ''; } else cell += c;
  }
  cells.push(cell.trim());
  if (text.startsWith('|')) cells.shift();
  if (text.endsWith('|') && !text.endsWith('\\|')) cells.pop();
  return cells.length > 1 ? cells : null;
}

export function verificationText(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n'); let fence = null;
  const separator = c => /^:?-+:?$/.test(c);
  const canonical = lines.map((line, i) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) { if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null; return line; }
    if (marker) { fence = marker[1]; return line; }
    if (!i || /^( {4}|\t)/.test(line) || /^( {4}|\t)/.test(lines[i - 1])) return line;
    const cells = tableCells(line), header = tableCells(lines[i - 1]);
    if (!cells || !header || cells.length !== header.length || !cells.every(separator) || header.every(separator)) return line;
    return '|' + cells.map(c => c.replace(/-+/g, '-')).join('|') + '|';
  });
  return normalizeText(canonical.join('\n'));
}

export function contentComparison(expected, actual) {
  const e = verificationText(expected), a = verificationText(actual); let difference = 0;
  while (difference < Math.min(e.length, a.length) && e[difference] === a[difference]) difference++;
  return { matched: a.includes(e), expectedLength: e.length, actualLength: a.length, expectedHash: hash(e), actualHash: hash(a), prefixDifference: difference, normalization: 'markdown-table-separators-v1' };
}
