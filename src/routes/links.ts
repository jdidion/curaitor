import { esc } from '../lib/utils.js';
import { Hono } from 'hono';
import { listLinks, getLink, createLink, deleteLink, linkCount } from '../services/links.js';
import { listTopics, addLinkToTopic } from '../services/topics.js';
import { layout } from '../views/layout.js';
import type { Link, LinkType, LinkBackend } from '../storage/types.js';

const app = new Hono();


const TYPE_ICONS: Record<string, string> = {
  paper: 'paper',
  repo: 'repo',
  tool: 'tool',
  article: 'article',
  video: 'video',
  podcast: 'podcast',
  other: 'link',
};

function linkRow(link: Link): string {
  const tags = link.tags.slice(0, 3).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
  const typeLabel = TYPE_ICONS[link.type] || 'link';
  return `<div class="article-item" style="display:flex;align-items:center;justify-content:space-between;">
    <div style="flex:1">
      <div class="title">
        <a href="${esc(link.url)}" target="_blank">${esc(link.title)}</a>
        <span class="tag" style="margin-left:6px;">${typeLabel}</span>
        ${link.backend !== 'obsidian' && link.backend !== 'sqlite' ? `<span class="tag" style="background:var(--accent);color:white;">${esc(link.backend)}</span>` : ''}
      </div>
      <div class="meta">${esc(link.description || '')}${link.category ? ` &middot; ${esc(link.category)}` : ''}</div>
      <div>${tags}</div>
    </div>
    <button class="btn btn-sm btn-danger" hx-delete="/links/${encodeURIComponent(link.id)}" hx-target="closest .article-item" hx-swap="outerHTML" hx-confirm="Delete this link?">x</button>
  </div>`;
}

function groupByCategory(links: Link[]): Record<string, Link[]> {
  const groups: Record<string, Link[]> = {};
  for (const link of links) {
    const cat = link.category || 'Uncategorized';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(link);
  }
  return groups;
}

app.get('/', (c) => {
  const typeFilter = c.req.query('type') as LinkType | undefined;
  const backendFilter = c.req.query('backend') as LinkBackend | undefined;
  const links = listLinks({ type: typeFilter, backend: backendFilter });
  const groups = groupByCategory(links);
  const total = links.length;

  const filterBar = `
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
      <a href="/links" class="btn btn-sm ${!typeFilter && !backendFilter ? 'btn-accent' : ''}">All (${total})</a>
      <a href="/links?type=paper" class="btn btn-sm ${typeFilter === 'paper' ? 'btn-accent' : ''}">Papers</a>
      <a href="/links?type=repo" class="btn btn-sm ${typeFilter === 'repo' ? 'btn-accent' : ''}">Repos</a>
      <a href="/links?type=tool" class="btn btn-sm ${typeFilter === 'tool' ? 'btn-accent' : ''}">Tools</a>
      <a href="/links?type=article" class="btn btn-sm ${typeFilter === 'article' ? 'btn-accent' : ''}">Articles</a>
      <a href="/links?type=video" class="btn btn-sm ${typeFilter === 'video' ? 'btn-accent' : ''}">Videos</a>
    </div>`;

  const groupHtml = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catLinks]) => `
    <div class="group">
      <div class="group-header">
        <span>${esc(cat)} <span class="count">(${catLinks.length})</span></span>
      </div>
      <div class="group-items">
        ${catLinks.map(linkRow).join('')}
      </div>
    </div>
  `).join('');

  const content = `
    <div class="page-header">
      <h1>Links <span style="color:var(--text-muted);font-size:16px;">${total} total</span></h1>
    </div>
    ${filterBar}
    <div id="links-list">
      ${groupHtml || '<p style="color:var(--text-muted);padding:40px;text-align:center;">No links yet</p>'}
    </div>
  `;

  return c.html(layout({ title: 'Links', content, activeNav: 'links' }));
});

app.delete('/:id', (c) => {
  deleteLink(c.req.param('id'));
  return c.html('');
});

app.post('/', async (c) => {
  const body = await c.req.parseBody();
  createLink({
    url: body['url'] as string,
    title: body['title'] as string,
    type: (body['type'] as LinkType) || 'article',
    category: body['category'] as string || '',
    description: body['description'] as string || '',
    tags: (body['tags'] as string || '').split(',').map((t) => t.trim()).filter(Boolean),
    backend: (body['backend'] as LinkBackend) || 'obsidian',
  });
  c.header('HX-Redirect', '/links');
  return c.html('');
});

export default app;
