import { esc } from '../lib/utils.js';
import { Hono } from 'hono';
import { listTopics, getTopic, createTopic, updateTopic, deleteTopic, getTopicLinks, removeLinkFromTopic } from '../services/topics.js';
import { layout } from '../views/layout.js';
import type { Topic, Link } from '../storage/types.js';

const app = new Hono();


function topicCard(topic: Topic): string {
  const tags = topic.tags.slice(0, 4).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
  return `<a href="/topics/${encodeURIComponent(topic.id)}" class="card" style="text-decoration:none;color:inherit;display:block;margin-bottom:12px;">
    <div style="display:flex;justify-content:space-between;align-items:start;">
      <div>
        <div style="font-weight:600;font-size:16px;">${esc(topic.name)}</div>
        <div style="color:var(--text-muted);font-size:13px;margin-top:4px;">${esc(topic.description || '')}</div>
        <div style="margin-top:6px;">${tags}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:24px;font-weight:700;color:var(--accent);">${topic.linkCount}</div>
        <div style="font-size:11px;color:var(--text-muted);">links</div>
      </div>
    </div>
  </a>`;
}

app.get('/', (c) => {
  const topics = listTopics();

  const content = `
    <div class="page-header">
      <h1>Topics <span style="color:var(--text-muted);font-size:16px;">${topics.length} topics</span></h1>
      <button class="btn btn-accent" onclick="document.getElementById('new-topic-form').style.display='block'">New Topic</button>
    </div>

    <div id="new-topic-form" style="display:none;margin:16px 0;">
      <form hx-post="/topics" hx-swap="none" class="card" style="display:flex;flex-direction:column;gap:12px;">
        <input type="text" name="name" placeholder="Topic name" required
          style="padding:8px 12px;background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:6px;font-size:14px;" />
        <input type="text" name="description" placeholder="Brief description of scope"
          style="padding:8px 12px;background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:6px;font-size:14px;" />
        <input type="text" name="tags" placeholder="Tags (comma-separated)"
          style="padding:8px 12px;background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:6px;font-size:14px;" />
        <div style="display:flex;gap:8px;">
          <button type="submit" class="btn btn-accent">Create</button>
          <button type="button" class="btn" onclick="this.closest('#new-topic-form').style.display='none'">Cancel</button>
        </div>
      </form>
    </div>

    <div>
      ${topics.length > 0 ? topics.map(topicCard).join('') : '<p style="color:var(--text-muted);padding:40px;text-align:center;">No topics yet. Create one to start organizing links.</p>'}
    </div>
  `;

  return c.html(layout({ title: 'Topics', content, activeNav: 'topics' }));
});

app.get('/:id', (c) => {
  const id = c.req.param('id');
  const topic = getTopic(id);
  if (!topic) return c.html('Topic not found', 404);

  const links = getTopicLinks(id);

  const linkRows = links.map((link) => `
    <div class="article-item" style="display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div class="title"><a href="${esc(link.url)}" target="_blank">${esc(link.title)}</a> <span class="tag">${esc(link.type)}</span></div>
        <div class="meta">${esc(link.description || '')}</div>
      </div>
      <button class="btn btn-sm btn-danger" hx-post="/topics/${encodeURIComponent(id)}/unlink/${encodeURIComponent(link.id)}" hx-target="closest .article-item" hx-swap="outerHTML">Unlink</button>
    </div>
  `).join('');

  const tags = topic.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ');

  const content = `
    <div class="page-header">
      <h1>${esc(topic.name)}</h1>
      <div style="display:flex;gap:8px;">
        <a href="/topics" class="btn btn-sm">Back</a>
        <button class="btn btn-sm btn-danger" hx-delete="/topics/${encodeURIComponent(id)}" hx-confirm="Delete this topic and unlink all articles?">Delete</button>
      </div>
    </div>
    <div style="color:var(--text-muted);margin:8px 0;">${esc(topic.description || '')}</div>
    <div style="margin:8px 0;">${tags}</div>
    ${topic.summary ? `<div class="card" style="margin:16px 0;"><h2 style="font-size:14px;color:var(--text-muted);margin-bottom:8px;">SUMMARY</h2><p>${esc(topic.summary)}</p></div>` : ''}

    <h2 style="font-size:16px;margin:20px 0 12px;">Links (${links.length})</h2>
    <div class="article-list" style="max-height:none;">
      ${linkRows || '<p style="color:var(--text-muted);padding:20px;text-align:center;">No links yet</p>'}
    </div>
  `;

  return c.html(layout({ title: topic.name, content, activeNav: 'topics' }));
});

app.post('/', async (c) => {
  const body = await c.req.parseBody();
  createTopic({
    name: body['name'] as string,
    description: body['description'] as string || '',
    tags: (body['tags'] as string || '').split(',').map((t) => t.trim()).filter(Boolean),
  });
  c.header('HX-Redirect', '/topics');
  return c.html('');
});

app.delete('/:id', (c) => {
  deleteTopic(c.req.param('id'));
  c.header('HX-Redirect', '/topics');
  return c.html('');
});

app.post('/:id/unlink/:linkId', (c) => {
  removeLinkFromTopic(c.req.param('linkId'), c.req.param('id'));
  return c.html('');
});

export default app;
