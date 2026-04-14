import { esc } from '../lib/utils.js';
import { Hono } from 'hono';
import { loadRecycle, clearRecycle } from '../services/recycle.js';
import { layout } from '../views/layout.js';

const app = new Hono();

app.get('/', (c) => {
  const entries = loadRecycle();

  const items = entries.length > 0
    ? entries
        .map(
          (e) => `<div class="article-item">
            <div class="title"><a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.title)}</a></div>
            <div class="meta">${esc(e.category)}${e.isDuplicate ? ' &middot; duplicate' : ''}</div>
          </div>`,
        )
        .join('')
    : '<p style="color:var(--text-muted);padding:40px;text-align:center">Recycle bin is empty</p>';

  const content = `
    <div class="page-header">
      <h1>Recycle</h1>
      <div style="display:flex;gap:8px;align-items:center">
        <span style="color:var(--text-muted)">${entries.length} items</span>
        ${entries.length > 0 ? `<button class="btn btn-danger btn-sm" hx-post="/recycle/clear" hx-target="body">Clear all</button>` : ''}
      </div>
    </div>
    <div class="card" style="margin-top:20px;padding:0;overflow:hidden">
      ${items}
    </div>`;

  return c.html(layout({ title: 'Recycle', content, activeNav: 'recycle' }));
});

app.post('/clear', (c) => {
  clearRecycle();
  c.header('HX-Redirect', '/recycle');
  return c.html('');
});


export default app;
