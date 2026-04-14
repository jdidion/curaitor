import { Hono } from 'hono';
import { listArticles, getArticle, moveArticle, deleteArticle } from '../services/vault.js';
import { loadStats, saveStats, addSignal } from '../services/metrics.js';
import { appendRecycle } from '../services/recycle.js';
import { isLikelySlop } from '../services/slop-detector.js';
import { layout } from '../views/layout.js';
import { esc, sanitizeId } from '../lib/utils.js';
import type { Article } from '../storage/types.js';

const app = new Hono();
const GROUP_THRESHOLD = 20;

function sourceKey(source: string): 'instapaper' | 'rss' {
  return source === 'instapaper' ? 'instapaper' : 'rss';
}

// --- Grouping logic ---

interface ArticleGroup {
  name: string;
  articles: Article[];
}

function groupArticles(articles: Article[]): { groups: ArticleGroup[]; standalone: Article[] } {
  // Build keyword index from tags and category
  const keywordMap = new Map<string, Article[]>();

  for (const a of articles) {
    const keys = [...a.tags, a.category].filter(Boolean).map((k) => k.toLowerCase());
    for (const key of keys) {
      if (!keywordMap.has(key)) keywordMap.set(key, []);
      keywordMap.get(key)!.push(a);
    }
  }

  // Find groups: keywords shared by 2+ articles
  const assigned = new Set<string>();
  const groups: ArticleGroup[] = [];

  // Sort by group size descending
  const candidates = [...keywordMap.entries()]
    .filter(([, arts]) => arts.length >= 2)
    .sort((a, b) => b[1].length - a[1].length);

  for (const [keyword, arts] of candidates) {
    const unassigned = arts.filter((a) => !assigned.has(a.filename));
    if (unassigned.length < 2) continue;

    groups.push({ name: keyword, articles: unassigned });
    for (const a of unassigned) assigned.add(a.filename);
  }

  const standalone = articles.filter((a) => !assigned.has(a.filename));
  return { groups, standalone };
}

// --- Rendering ---

function slopBadge(article: Article): string {
  const result = isLikelySlop(article.title, article.summary, article.url);
  if (result.label === 'clean') return '';
  const colors: Record<string, string> = {
    'mild': 'var(--yellow)',
    'slop': 'var(--red)',
    'heavy-slop': '#ff2222',
  };
  const color = colors[result.label] || 'var(--text-muted)';
  const signals = result.signals.slice(0, 3).map((s) => s.detail).join(', ');
  return `<span class="tag" style="background:${color};color:white;font-weight:600;" title="${esc(signals)}">
    SLOP ${Math.round(result.score * 100)}%
  </span>`;
}

function renderDetail(article: Article): string {
  const tags = article.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ');
  const fn = encodeURIComponent(article.filename);
  const slop = slopBadge(article);
  return `
    <h1>${esc(article.title)} ${slop}</h1>
    <div class="meta-row">
      <span>${esc(article.source || 'unknown')}</span>
      <span>${esc(article.category)}</span>
      <span>${article.dateTriaged}</span>
      ${article.url ? `<a href="${esc(article.url)}" target="_blank">Open &rarr;</a>` : ''}
    </div>
    <div style="margin:8px 0">${tags}</div>
    ${article.summary ? `<div class="section"><h2>Summary</h2><p>${esc(article.summary)}</p></div>` : ''}
    ${article.whyReview ? `<div class="section"><h2>Why Review?</h2><p>${esc(article.whyReview)}</p></div>` : ''}
    ${article.takeaways.length ? `<div class="section"><h2>Key Takeaways</h2><ul>${article.takeaways.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
    <div class="verdict-bar">
      <button class="verdict-btn primary" hx-post="/review/${fn}/verdict" hx-vals='{"verdict":"y"}' hx-target="#article-detail"><span class="key">y</span> Inbox</button>
      <button class="verdict-btn" hx-post="/review/${fn}/verdict" hx-vals='{"verdict":"n"}' hx-target="#article-detail"><span class="key">n</span> Recycle</button>
      <button class="verdict-btn" hx-post="/review/${fn}/verdict" hx-vals='{"verdict":"t"}' hx-target="#article-detail"><span class="key">t</span> Topic</button>
      <button class="verdict-btn" hx-post="/review/${fn}/verdict" hx-vals='{"verdict":"c"}' hx-target="#article-detail"><span class="key">c</span> Clip</button>
      <button class="verdict-btn" hx-post="/review/${fn}/verdict" hx-vals='{"verdict":"b"}' hx-target="#article-detail"><span class="key">b</span> Bookmark</button>
      <button class="verdict-btn" hx-post="/review/${fn}/verdict" hx-vals='{"verdict":"skip"}' hx-target="#article-detail"><span class="key">s</span> Skip</button>
    </div>
  `;
}

function renderGroupedView(groups: ArticleGroup[], standalone: Article[], total: number): string {
  const groupHtml = groups.map((g) => {
    const filenames = g.articles.map((a) => a.filename).join(',');
    const items = g.articles.map((a) => {
      const fn = encodeURIComponent(a.filename);
      const tags = a.tags.slice(0, 2).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
      return `<div class="article-item" hx-get="/review/${fn}" hx-target="#article-detail" hx-swap="innerHTML">
        <div class="title">${esc(a.title)}</div>
        <div class="meta">${a.source || 'unknown'} &middot; ${a.dateTriaged}</div>
        <div>${tags}</div>
      </div>`;
    }).join('');

    return `<div class="group">
      <div class="group-header">
        <span>${esc(g.name)} <span class="count">(${g.articles.length})</span></span>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm btn-accent" hx-post="/review/batch" hx-vals='${esc(JSON.stringify({ verdict: 'y', filenames }))}' hx-target="#review-content" hx-swap="innerHTML">
            <span class="key">y</span> All to Inbox
          </button>
          <button class="btn btn-sm" hx-post="/review/batch" hx-vals='${esc(JSON.stringify({ verdict: 't', filenames, topic: g.name }))}' hx-target="#review-content" hx-swap="innerHTML">
            <span class="key">t</span> Topic: ${esc(g.name)}
          </button>
          <button class="btn btn-sm btn-danger" hx-post="/review/batch" hx-vals='${esc(JSON.stringify({ verdict: 'n', filenames }))}' hx-target="#review-content" hx-swap="innerHTML">
            <span class="key">n</span> Recycle all
          </button>
        </div>
      </div>
      <div class="group-items">${items}</div>
    </div>`;
  }).join('');

  const standaloneHtml = standalone.length > 0 ? `
    <div class="group" style="margin-top:20px;">
      <div class="group-header">
        <span>Standalone <span class="count">(${standalone.length})</span></span>
      </div>
      <div class="group-items">
        ${standalone.map((a) => {
          const fn = encodeURIComponent(a.filename);
          const tags = a.tags.slice(0, 2).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
          return `<div class="article-item" hx-get="/review/${fn}" hx-target="#article-detail" hx-swap="innerHTML">
            <div class="title">${esc(a.title)}</div>
            <div class="meta">${a.source || 'unknown'} &middot; ${a.category} &middot; ${a.dateTriaged}</div>
            <div>${tags}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  ` : '';

  return `
    <div class="page-header">
      <h1>Review <span style="color:var(--text-muted);font-size:16px">${total} articles (${groups.length} groups + ${standalone.length} standalone)</span></h1>
      <a href="/review?flat=1" class="btn btn-sm">Flat view</a>
    </div>
    <div class="two-pane">
      <div class="article-list" id="article-list">
        ${groupHtml}
        ${standaloneHtml}
      </div>
      <div class="article-detail" id="article-detail">
        <p style="color:var(--text-muted);padding:40px;text-align:center;">
          Select a group action or click an article to review individually
        </p>
      </div>
    </div>
  `;
}

function renderFlatView(articles: Article[]): string {
  const list = articles.map((a) => {
    const tags = a.tags.slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
    const fn = encodeURIComponent(a.filename);
    const slop = slopBadge(a);
    return `<div class="article-item" hx-get="/review/${fn}" hx-target="#article-detail" hx-swap="innerHTML">
      <div class="title">${esc(a.title)} ${slop}</div>
      <div class="meta">${a.source || 'unknown'} &middot; ${a.category} &middot; ${a.dateTriaged}</div>
      <div>${tags}</div>
    </div>`;
  }).join('');

  const first = articles[0];
  return `
    <div class="page-header">
      <h1>Review <span style="color:var(--text-muted);font-size:16px">${articles.length} articles</span></h1>
      ${articles.length >= GROUP_THRESHOLD ? '<a href="/review" class="btn btn-sm">Grouped view</a>' : ''}
    </div>
    <div class="two-pane">
      <div class="article-list" id="article-list">${list}</div>
      <div class="article-detail" id="article-detail">
        ${first ? renderDetail(first) : '<p style="color:var(--text-muted);padding:40px;text-align:center;">Review queue is empty</p>'}
      </div>
    </div>
  `;
}

// --- Routes ---

app.get('/', (c) => {
  const articles = listArticles('review');
  const flat = c.req.query('flat') === '1';

  let content: string;
  if (articles.length >= GROUP_THRESHOLD && !flat) {
    const { groups, standalone } = groupArticles(articles);
    content = renderGroupedView(groups, standalone, articles.length);
  } else {
    content = renderFlatView(articles);
  }

  return c.html(layout({ title: 'Review', content, activeNav: 'review', navCounts: { review: articles.length } }));
});

app.get('/:filename', (c) => {
  const filename = sanitizeId(c.req.param('filename'));
  if (!filename) return c.html('<p>Invalid filename</p>', 400);
  const article = getArticle('review', filename);
  if (!article) return c.html('<p>Article not found</p>', 404);
  return c.html(renderDetail(article));
});

// Single article verdict
app.post('/:filename/verdict', async (c) => {
  const filename = sanitizeId(c.req.param('filename'));
  if (!filename) return c.html('<p>Invalid filename</p>', 400);
  const body = await c.req.parseBody();
  const verdict = (body.verdict as string) || 'skip';
  const article = getArticle('review', filename);
  if (!article) return c.html('<p>Article not found</p>', 404);

  const stats = loadStats();
  applyVerdict(verdict, article, stats);
  saveStats(stats);

  const remaining = listArticles('review');
  const next = remaining[0];
  if (next) return c.html(renderDetail(next));
  return c.html('<p style="color:var(--text-muted);padding:40px;text-align:center;">Review queue is empty</p>');
});

// Batch verdict for a group
app.post('/batch', async (c) => {
  const body = await c.req.parseBody();
  const verdict = body.verdict as string;
  const filenames = (body.filenames as string || '').split(',').filter(Boolean);

  const stats = loadStats();
  let processed = 0;

  for (const filename of filenames) {
    const safe = sanitizeId(filename);
    if (!safe) continue;
    const article = getArticle("review", safe);
    if (!article) continue;
    applyVerdict(verdict, article, stats);
    processed++;
  }

  saveStats(stats);

  // Re-render the full grouped view
  const remaining = listArticles('review');
  if (remaining.length >= GROUP_THRESHOLD) {
    const { groups, standalone } = groupArticles(remaining);
    return c.html(`
      <div style="padding:12px;background:var(--bg-card);border:1px solid var(--green);border-radius:var(--radius);margin-bottom:16px;">
        ${processed} articles ${verdict === 'n' ? 'recycled' : verdict === 'y' ? 'moved to inbox' : 'processed'}
      </div>
      ${renderGroupedView(groups, standalone, remaining.length)}
    `);
  }
  return c.html(renderFlatView(remaining));
});

function applyVerdict(verdict: string, article: Article, stats: ReturnType<typeof loadStats>): void {
  const src = sourceKey(article.source);

  switch (verdict) {
    case 'y':
      moveArticle('review', 'inbox', article.filename);
      addSignal(stats, src, 'tp', article.title);
      break;
    case 'n':
      appendRecycle(article.title, article.url);
      deleteArticle('review', article.filename);
      addSignal(stats, src, 'fp', article.title);
      break;
    case 't':
    case 'c':
    case 'b':
      deleteArticle('review', article.filename);
      addSignal(stats, src, 'tp', article.title);
      break;
    case 'skip':
      break;
  }
}

export default app;
