import type { Article } from '../lib/frontmatter.js';

export function statCard(opts: {
  value: number | string;
  label: string;
  color?: string;
}): string {
  const style = opts.color ? ` style="color:${opts.color}"` : '';
  return `<div class="card stat-card">
  <div class="stat-value"${style}>${opts.value}</div>
  <div class="stat-label">${opts.label}</div>
</div>`;
}

export function metricGauge(opts: {
  label: string;
  value: number;
  max?: number;
  color?: string;
}): string {
  const max = opts.max ?? 100;
  const pct = max > 0 ? Math.round((opts.value / max) * 100) : 0;
  const color = opts.color || 'var(--accent)';
  return `<div class="gauge">
  <span>${opts.label}</span>
  <div class="gauge-bar">
    <div class="gauge-fill" style="width:${pct}%;background:${color}"></div>
  </div>
  <span>${pct}%</span>
</div>`;
}

export function articleCard(
  article: Pick<Article, 'filename' | 'title' | 'category' | 'source' | 'dateTriaged' | 'tags'>,
  opts?: { active?: boolean; hxGet?: string; folder?: string },
): string {
  const active = opts?.active ? ' active' : '';
  const folder = opts?.folder || 'review';
  const hxGet = opts?.hxGet || `/${folder}/${encodeURIComponent(article.filename)}`;
  const tags = article.tags
    .slice(0, 4)
    .map((t) => `<span class="tag">${esc(t)}</span>`)
    .join('');

  return `<div class="article-item${active}"
     hx-get="${hxGet}"
     hx-target="#detail"
     hx-swap="innerHTML"
     hx-push-url="true"
     style="cursor:pointer">
  <div class="title">${esc(article.title)}</div>
  <div class="meta">${esc(article.source)} &middot; ${esc(article.category)} &middot; ${esc(article.dateTriaged)}</div>
  <div>${tags}</div>
</div>`;
}

export function articleDetail(
  article: Pick<Article, 'title' | 'url' | 'category' | 'source' | 'dateTriaged' | 'tags' | 'summary' | 'whyReview' | 'verdictText' | 'takeaways'> & { filename?: string },
  opts?: {
    verdicts?: Array<{ key: string; label: string; primary?: boolean }>;
    folder?: string;
  },
): string {
  const folder = opts?.folder || 'review';
  const filename = (article as Article).filename || '';

  const takeawayItems = article.takeaways.length
    ? `<ul>${article.takeaways.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
    : '';

  const tags = article.tags
    .map((t) => `<span class="tag">${esc(t)}</span>`)
    .join(' ');

  const verdictButtons = (opts?.verdicts || [])
    .map((v) => {
      const cls = v.primary ? ' primary' : '';
      return `<button class="verdict-btn${cls}"
        hx-post="/${folder}/${encodeURIComponent(filename)}/verdict"
        hx-vals='${JSON.stringify({ verdict: v.key })}'
        hx-target="#detail"
        hx-swap="innerHTML">
    <span class="key">${esc(v.key)}</span>${esc(v.label)}
  </button>`;
    })
    .join('\n    ');

  const verdictBar = verdictButtons
    ? `\n  <div class="verdict-bar">\n    ${verdictButtons}\n  </div>`
    : '';

  return `<div class="article-detail">
  <h1>${esc(article.title)}</h1>
  <div class="meta-row">
    <span>${esc(article.source)}</span>
    <span>${esc(article.category)}</span>
    <span>${esc(article.dateTriaged)}</span>
  </div>

  <div class="section">
    <h2>Summary</h2>
    <p>${esc(article.summary)}</p>
  </div>

  ${article.whyReview ? `<div class="section">
    <h2>Why Review?</h2>
    <p>${esc(article.whyReview)}</p>
  </div>` : ''}

  ${takeawayItems ? `<div class="section">
    <h2>Key Takeaways</h2>
    ${takeawayItems}
  </div>` : ''}

  <div class="section">
    <div>${tags}</div>
  </div>

  <div class="section">
    <a href="${esc(article.url)}" target="_blank" rel="noopener">Open article &rarr;</a>
  </div>
  ${verdictBar}
</div>`;
}

export function groupedList(
  groups: Array<{
    name: string;
    count: number;
    items: Array<{ title: string; url: string; filename?: string }>;
  }>,
  opts?: { confirmAction?: string; rescueAction?: string },
): string {
  return groups
    .map((group) => {
      const actionBtns: string[] = [];
      if (opts?.confirmAction) {
        actionBtns.push(
          `<button class="btn btn-sm" hx-post="${opts.confirmAction}" hx-vals='${JSON.stringify({ group: group.name })}'>Confirm All</button>`,
        );
      }
      if (opts?.rescueAction) {
        actionBtns.push(
          `<button class="btn btn-sm btn-accent" hx-post="${opts.rescueAction}" hx-vals='${JSON.stringify({ group: group.name })}'>Rescue All</button>`,
        );
      }
      const actions = actionBtns.length
        ? `<div style="display:flex;gap:8px">${actionBtns.join('')}</div>`
        : '';

      const items = group.items
        .map(
          (item) =>
            `<div class="article-item">
      <div class="title"><a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title)}</a></div>
    </div>`,
        )
        .join('\n    ');

      return `<div class="group">
  <div class="group-header">
    <span>${esc(group.name)} <span class="count">(${group.count})</span></span>
    ${actions}
  </div>
  <div class="group-items">
    ${items}
  </div>
</div>`;
    })
    .join('\n');
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
