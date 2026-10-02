// This fallback is an excerpt, never a model-generated synthesis.
export function graphSummary(document) {
  const supplied = typeof document.summary === 'string' ? document.summary.trim() : '';
  if (supplied && document.hash && document.summaryForHash === document.hash) {
    return { summary: supplied.slice(0, 400), summaryKind: 'summary', summaryStale: false };
  }
  const paragraphs = []; let fenced = false;
  for (const raw of (document.markdown || '').split('\n')) {
    const line = raw.trim();
    if (/^(```|~~~)/.test(line)) { fenced = !fenced; continue; }
    if (fenced || !line || /^#{1,6}\s|^<\/?(?:title|script|style)\b|^ELX记录(?:\s|$)|^https?:\/\//i.test(line)) continue;
    const plain = line.replace(/[*_`]/g, '');
    if (/^(?:[-+]\s*)?(?:来源|原文|作者|作者／发布日期|日期|时间|链接|URL|覆盖范围|获取方式|获取时间|获取日期与覆盖|收藏理由|状态|标题)\s*[:：]/i.test(plain)) continue;
    if (/^(?:[-+]\s*|\d+[.)]\s*)?(?:\[[^\]]+\]\([^)]+\)\s*)+$/.test(line)) continue;
    const text = plain.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/<[^>]*>/g, '').replace(/^[-+]\s+|^\d+[.)]\s+/, '').trim();
    if (text) paragraphs.push(text);
    if (paragraphs.join(' ').length >= 400) break;
  }
  const summary = paragraphs.join(' ').slice(0, 400);
  return { summary, summaryKind: summary ? 'excerpt' : 'missing', summaryStale: !!supplied };
}
