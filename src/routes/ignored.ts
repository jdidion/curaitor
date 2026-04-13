import { Hono } from 'hono';
import { listArticles, getArticle, moveArticle, deleteArticle } from '../services/vault.js';
import { loadStats, saveStats, addSignal } from '../services/metrics.js';
import { appendRecycle } from '../services/recycle.js';
import { layout } from '../views/layout.js';
import { groupedList } from '../views/components.js';

const app = new Hono();

app.get('/', (c) => {
  const articles = listArticles('ignored');

  const grouped = new Map<string, typeof articles>();
  for (const a of articles) {
    const cat = a.category || 'uncategorized';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(a);
  }

  const groups = Array.from(grouped.entries()).map(([name, items]) => ({
    name,
    count: items.length,
    items: items.map((a) => ({ title: a.title, url: a.url, filename: a.filename })),
  }));

  const html = groupedList(groups, {
    confirmAction: '/ignored/confirm-category',
    rescueAction: '/ignored',
  });

  const content = `
    <div class="page-header">
      <h1>Ignored</h1>
      <span style="color:var(--text-muted)">${articles.length} articles</span>
    </div>
    <div style="margin-top:20px">
      ${html}
    </div>`;

  return c.html(layout({ title: 'Ignored', content, activeNav: 'ignored' }));
});

app.post('/confirm-category', async (c) => {
  const body = await c.req.parseBody();
  const category = body['group'] as string;
  const articles = listArticles('ignored').filter((a) => (a.category || 'uncategorized') === category);
  const stats = loadStats();

  for (const article of articles) {
    const source: 'instapaper' | 'rss' = article.source === 'instapaper' ? 'instapaper' : 'rss';
    appendRecycle(article.title, article.url);
    deleteArticle('ignored', article.filename);
    addSignal(stats, source, 'tn', article.title);
  }

  saveStats(stats);

  return c.html('');
});

app.post('/:filename/rescue', async (c) => {
  const filename = c.req.param('filename');
  const article = getArticle('ignored', filename);

  if (!article) {
    return c.html('<p style="color:var(--text-muted);padding:20px">Article not found</p>', 404);
  }

  const source: 'instapaper' | 'rss' = article.source === 'instapaper' ? 'instapaper' : 'rss';
  const stats = loadStats();

  moveArticle('ignored', 'review', filename);
  addSignal(stats, source, 'fn', article.title);
  saveStats(stats);

  return c.html('');
});

export default app;
