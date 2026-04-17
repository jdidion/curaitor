import { Hono } from 'hono';
import { listArticles, getArticle, deleteArticle } from '../services/vault.js';
import { loadStats, saveStats, addSignal } from '../services/metrics.js';
import { appendRecycle } from '../services/recycle.js';
import { listTopics } from '../services/topics.js';
import { layout } from '../views/layout.js';
import { esc, sanitizeId } from '../lib/utils.js';
import { articleCard } from '../views/components.js';
import type { Article } from '../storage/types.js';

const app = new Hono();

function topicPicker(fn: string, folder: string): string {
  const topics = listTopics();
  if (topics.length === 0) {
    return `<button class="verdict-btn" hx-post="/${folder}/${fn}/verdict" hx-vals='{"verdict":"t"}' hx-target="#detail" hx-swap="innerHTML"><span class="key">t</span> Topic</button>`;
  }
  const options = topics
    .map((t) => `<option value="${esc(t.id)}">${esc(t.name)} (${t.linkCount})</option>`)
    .join('');
  return `
    <span style="display:inline-flex;align-items:center;gap:4px;">
      <select id="topic-select-${fn}" style="padding:5px 8px;background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:6px;font-size:13px;font-family:var(--font);max-width:180px;">
        <option value="">+ New topic...</option>
        ${options}
      </select>
      <button class="verdict-btn" onclick="
        var sel = document.getElementById('topic-select-${fn}');
        htmx.ajax('POST', '/${folder}/${fn}/verdict', {target:'#detail', swap:'innerHTML', values:{verdict:'t', topic: sel.value}});
      "><span class="key">t</span> Add</button>
    </span>`;
}

function renderReadDetail(article: Article): string {
  const tags = article.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ');
  const fn = encodeURIComponent(article.filename);
  return `<div class="article-detail">
    <h1>${esc(article.title)}</h1>
    <div class="meta-row">
      <span>${esc(article.source)}</span>
      <span>${esc(article.category)}</span>
      <span>${esc(article.dateTriaged)}</span>
      ${article.url ? `<a href="${esc(article.url)}" target="_blank">Open &rarr;</a>` : ''}
    </div>
    <div style="margin:8px 0">${tags}</div>
    ${article.summary ? `<div class="section"><h2>Summary</h2><p>${esc(article.summary)}</p></div>` : ''}
    ${article.verdictText ? `<div class="section"><h2>Verdict</h2><p>${esc(article.verdictText)}</p></div>` : ''}
    ${article.takeaways.length ? `<div class="section"><h2>Key Takeaways</h2><ul>${article.takeaways.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
    <div class="verdict-bar">
      <button class="verdict-btn primary" hx-post="/read/${fn}/verdict" hx-vals='{"verdict":"r"}' hx-target="#detail" hx-swap="innerHTML"><span class="key">r</span> Zotero</button>
      ${topicPicker(fn, 'read')}
      <button class="verdict-btn" hx-post="/read/${fn}/verdict" hx-vals='{"verdict":"c"}' hx-target="#detail" hx-swap="innerHTML"><span class="key">c</span> Clip</button>
      <button class="verdict-btn" hx-post="/read/${fn}/verdict" hx-vals='{"verdict":"b"}' hx-target="#detail" hx-swap="innerHTML"><span class="key">b</span> Bookmark</button>
      <button class="verdict-btn" hx-post="/read/${fn}/verdict" hx-vals='{"verdict":"n"}' hx-target="#detail" hx-swap="innerHTML"><span class="key">n</span> Recycle</button>
      <button class="verdict-btn" hx-post="/read/${fn}/verdict" hx-vals='{"verdict":"skip"}' hx-target="#detail" hx-swap="innerHTML"><span class="key">s</span> Skip</button>
    </div>
  </div>`;
}

app.get('/', (c) => {
  const articles = listArticles('inbox');
  const list = articles
    .map((a) => articleCard(a, { folder: 'read' }))
    .join('');

  const placeholder = '<p style="color:var(--text-muted);padding:40px;text-align:center">Select an article to read</p>';

  const content = `
    <div class="page-header"><h1>Read</h1><span style="color:var(--text-muted)">${articles.length} articles</span></div>
    <div class="two-pane">
      <div class="article-list">${list || '<p style="color:var(--text-muted);padding:40px;text-align:center">Inbox is empty</p>'}</div>
      <div id="detail">${placeholder}</div>
    </div>`;

  return c.html(layout({ title: 'Read', content, activeNav: 'read' }));
});

app.get('/:filename', (c) => {
  const filename = sanitizeId(c.req.param('filename'));
  if (!filename) return c.html('<p>Invalid filename</p>', 400);
  const article = getArticle('inbox', filename);
  if (!article) {
    return c.html('<p style="color:var(--text-muted);padding:20px">Article not found</p>', 404);
  }

  const html = renderReadDetail(article);

  if (c.req.header('HX-Request')) {
    return c.html(html);
  }

  const articles = listArticles('inbox');
  const list = articles
    .map((a) => articleCard(a, { folder: 'read', active: a.filename === filename }))
    .join('');

  const content = `
    <div class="page-header"><h1>Read</h1><span style="color:var(--text-muted)">${articles.length} articles</span></div>
    <div class="two-pane">
      <div class="article-list">${list}</div>
      <div id="detail">${html}</div>
    </div>`;

  return c.html(layout({ title: `Read: ${article.title}`, content, activeNav: 'read' }));
});

app.post('/:filename/verdict', async (c) => {
  const filename = sanitizeId(c.req.param('filename'));
  if (!filename) return c.html('<p>Invalid filename</p>', 400);
  const body = await c.req.parseBody();
  const verdict = body['verdict'] as string;
  const article = getArticle('inbox', filename);

  if (!article) {
    return c.html('<p style="color:var(--text-muted);padding:20px">Article not found</p>', 404);
  }

  const source: 'instapaper' | 'rss' = article.source === 'instapaper' ? 'instapaper' : 'rss';
  const stats = loadStats();

  switch (verdict) {
    case 'r':
      // Keep in inbox for Zotero save (handled externally)
      addSignal(stats, source, 'tp', article.title);
      break;
    case 't':
      addSignal(stats, source, 'tp', article.title);
      break;
    case 'c':
      deleteArticle('inbox', filename);
      addSignal(stats, source, 'tp', article.title);
      break;
    case 'b':
      deleteArticle('inbox', filename);
      addSignal(stats, source, 'tp', article.title);
      break;
    case 'n':
      appendRecycle(article.title, article.url);
      deleteArticle('inbox', filename);
      // Not a triage signal — article was correctly routed to Inbox,
      // user just doesn't want to keep it after reading.
      break;
    case 'skip':
      break;
  }

  saveStats(stats);

  c.header('HX-Trigger', 'verdictApplied');
  return c.html(`<p style="color:var(--green);padding:20px;text-align:center">
    ${verdict === 'skip' ? 'Skipped' : `Applied verdict: ${verdict}`} &mdash; <em>${esc(article.title)}</em>
  </p>`);
});


export default app;
