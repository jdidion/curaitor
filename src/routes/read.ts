import { Hono } from 'hono';
import { listArticles, getArticle, deleteArticle } from '../services/vault.js';
import { loadStats, saveStats, addSignal } from '../services/metrics.js';
import { appendRecycle } from '../services/recycle.js';
import { layout } from '../views/layout.js';
import { articleCard, articleDetail } from '../views/components.js';

const VERDICTS = [
  { key: 'r', label: 'Zotero', primary: true },
  { key: 't', label: 'Topic' },
  { key: 'c', label: 'Clip' },
  { key: 'b', label: 'Bookmark' },
  { key: 'n', label: 'Recycle' },
  { key: 'skip', label: 'Skip' },
];

const app = new Hono();

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
  const filename = c.req.param('filename');
  const article = getArticle('inbox', filename);
  if (!article) {
    return c.html('<p style="color:var(--text-muted);padding:20px">Article not found</p>', 404);
  }

  const html = articleDetail(article, { verdicts: VERDICTS, folder: 'read' });

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
  const filename = c.req.param('filename');
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
      addSignal(stats, source, 'fp', article.title);
      break;
    case 'skip':
      break;
  }

  saveStats(stats);

  c.header('HX-Trigger', 'verdictApplied');
  return c.html(`<p style="color:var(--green);padding:20px;text-align:center">
    ${verdict === 'skip' ? 'Skipped' : `Applied verdict: ${verdict}`} &mdash; <em>${escapeHtml(article.title)}</em>
  </p>`);
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default app;
