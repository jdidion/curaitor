import matter from 'gray-matter';

export interface Article {
  filename: string;
  path: string;
  title: string;
  url: string;
  source: string;
  category: string;
  confidence: string;
  verdict: string;
  tags: string[];
  dateSaved?: string;
  dateTriaged: string;
  bookmarkId?: number;
  mediaType?: string;
  reviewedIgnored?: string;
  reviewDecision?: string;
  autonomyLevel?: number;
  summary: string;
  whyReview: string;
  verdictText: string;
  takeaways: string[];
  body: string;
}

function toStr(val: unknown): string {
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'string') return val;
  return val ? String(val) : '';
}

export function parseArticle(content: string, filename: string, relPath: string): Article {
  const { data: fm, content: body } = matter(content);

  const sections = extractSections(body);

  return {
    filename,
    path: relPath,
    title: fm.title || filename.replace('.md', ''),
    url: fm.url || '',
    source: fm.source || '',
    category: fm.category || 'general',
    confidence: fm.confidence || '',
    verdict: fm.verdict || '',
    tags: Array.isArray(fm.tags) ? fm.tags : fm.tags ? [fm.tags] : [],
    dateSaved: toStr(fm.date_saved),
    dateTriaged: toStr(fm.date_triaged) || '',
    bookmarkId: fm.bookmark_id,
    mediaType: fm.media_type,
    reviewedIgnored: fm.reviewed_ignored,
    reviewDecision: fm.review_decision,
    autonomyLevel: fm.autonomy_level,
    summary: sections.summary || '',
    whyReview: sections['why review?'] || sections['verdict'] || '',
    verdictText: sections['verdict'] || '',
    takeaways: extractBullets(sections['key takeaways'] || ''),
    body,
  };
}

function extractSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let current: string | null = null;
  const lines: string[] = [];

  for (const line of body.split('\n')) {
    if (line.startsWith('## ')) {
      if (current) sections[current] = lines.join('\n').trim();
      current = line.slice(3).trim().toLowerCase();
      lines.length = 0;
    } else if (current) {
      lines.push(line);
    }
  }
  if (current) sections[current] = lines.join('\n').trim();
  return sections;
}

function extractBullets(text: string): string[] {
  return text
    .split('\n')
    .filter((l) => l.trim().startsWith('- '))
    .map((l) => l.trim().slice(2));
}

export function buildFrontmatter(article: Partial<Article>): Record<string, unknown> {
  const fm: Record<string, unknown> = {};
  if (article.title) fm.title = article.title;
  if (article.url) fm.url = article.url;
  if (article.source) fm.source = article.source;
  if (article.dateTriaged) fm.date_triaged = article.dateTriaged;
  if (article.category) fm.category = article.category;
  if (article.confidence) fm.confidence = article.confidence;
  if (article.verdict) fm.verdict = article.verdict;
  if (article.tags?.length) fm.tags = article.tags;
  if (article.bookmarkId) fm.bookmark_id = article.bookmarkId;
  if (article.dateSaved) fm.date_saved = article.dateSaved;
  if (article.mediaType) fm.media_type = article.mediaType;
  if (article.reviewedIgnored) fm.reviewed_ignored = article.reviewedIgnored;
  if (article.reviewDecision) fm.review_decision = article.reviewDecision;
  if (article.autonomyLevel !== undefined) fm.autonomy_level = article.autonomyLevel;
  return fm;
}
