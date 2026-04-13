import { Hono } from 'hono';
import { listArticles, getArticle, moveArticle, deleteArticle, updateFrontmatter, folderCount } from '../services/vault.js';
import { loadStats, saveStats, addSignal } from '../services/metrics.js';
import { appendRecycle } from '../services/recycle.js';
import { layout } from '../views/layout.js';
import type { Article } from '../lib/frontmatter.js';

const app = new Hono();

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sourceKey(source: string): 'instapaper' | 'rss' {
  return source === 'instapaper' ? 'instapaper' : 'rss';
}

function renderDetail(article: Article): string {
  const tags = article.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ');
  const fn = encodeURIComponent(article.filename);
  return `
    <h1>${esc(article.title)}</h1>
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

function renderList(articles: Article[]): string {
  return articles.map((a) => {
    const tags = a.tags.slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
    const fn = encodeURIComponent(a.filename);
    return `<div class="article-item" hx-get="/review/${fn}" hx-target="#article-detail" hx-swap="innerHTML">
      <div class="title">${esc(a.title)}</div>
      <div class="meta">${a.source || 'unknown'} &middot; ${a.category} &middot; ${a.dateTriaged}</div>
      <div>${tags}</div>
    </div>`;
  }).join('');
}

app.get('/', (c) => {
  const articles = listArticles('review');
  const first = articles[0];

  const content = `
    <div class="page-header">
      <h1>Review <span style="color:var(--text-muted);font-size:16px">${articles.length} articles</span></h1>
    </div>
    <div class="two-pane">
      <div class="article-list" id="article-list">
        ${renderList(articles)}
      </div>
      <div class="article-detail" id="article-detail">
        ${first ? renderDetail(first) : '<p style="color:var(--text-muted);padding:40px;text-align:center;">Review queue is empty</p>'}
      </div>
    </div>
  `;

  return c.html(layout({ title: 'Review', content, activeNav: 'review', navCounts: { review: articles.length } }));
});

app.get('/:filename', (c) => {
  const article = getArticle('review', c.req.param('filename'));
  if (!article) return c.html('<p>Article not found</p>', 404);
  return c.html(renderDetail(article));
});

app.post('/:filename/verdict', async (c) => {
  const filename = c.req.param('filename');
  const body = await c.req.parseBody();
  const verdict = (body.verdict as string) || 'skip';
  const article = getArticle('review', filename);
  if (!article) return c.html('<p>Article not found</p>', 404);

  const stats = loadStats();
  const src = sourceKey(article.source);

  switch (verdict) {
    case 'y':
      moveArticle('review', 'inbox', filename);
      addSignal(stats, src, 'tp', article.title);
      break;
    case 'n':
      appendRecycle(article.title, article.url);
      deleteArticle('review', filename);
      addSignal(stats, src, 'fp', article.title);
      break;
    case 't':
    case 'c':
    case 'b':
      deleteArticle('review', filename);
      addSignal(stats, src, 'tp', article.title);
      break;
    case 'skip':
      break;
  }

  saveStats(stats);

  // Return next article
  const remaining = listArticles('review');
  const next = remaining[0];
  if (next) return c.html(renderDetail(next));
  return c.html('<p style="color:var(--text-muted);padding:40px;text-align:center;">Review queue is empty</p>');
});

export default app;
