import { Hono } from 'hono';
import { allFolderCounts } from '../services/vault.js';
import { loadStats, computeMetrics } from '../services/metrics.js';
import { recycleCount } from '../services/recycle.js';
import { esc } from '../lib/utils.js';
import { layout } from '../views/layout.js';

const app = new Hono();

app.get('/', (c) => {
  const counts = allFolderCounts();
  const stats = loadStats();
  const metrics = computeMetrics(stats);
  const recCount = recycleCount();

  const content = `
    <div class="page-header">
      <h1>Dashboard</h1>
    </div>
    <div style="font-size:13px;color:var(--text-dim);margin-top:16px;">Articles currently in queue</div>

    <div class="card-grid">
      <a href="/read" class="card stat-card" style="text-decoration:none;color:inherit;">
        <div class="stat-value" style="color: var(--green)">${counts.inbox}</div>
        <div class="stat-label">Inbox</div>
      </a>
      <a href="/review" class="card stat-card" style="text-decoration:none;color:inherit;">
        <div class="stat-value" style="color: var(--yellow)">${counts.review}</div>
        <div class="stat-label">Review</div>
      </a>
      <a href="/ignored" class="card stat-card" style="text-decoration:none;color:inherit;">
        <div class="stat-value" style="color: var(--text-muted)">${counts.ignored}</div>
        <div class="stat-label">Ignored</div>
      </a>
      <a href="/recycle" class="card stat-card" style="text-decoration:none;color:inherit;">
        <div class="stat-value" style="color: var(--text-dim)">${recCount}</div>
        <div class="stat-label">Recycled</div>
      </a>
    </div>

    <div class="card-grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
      <div class="card">
        <h2 style="font-size:16px;margin-bottom:16px;">Autonomy Level</h2>
        <div class="stat-value" style="font-size:48px;color:var(--accent)">${metrics.level}</div>
        <div class="stat-label">${metrics.levelName}</div>
        <div style="margin-top:16px;">
          <div class="gauge">
            <span>Precision</span>
            <div class="gauge-bar">
              <div class="gauge-fill" style="width:${Math.round(metrics.rollingPrecision * 100)}%;background:var(--green)"></div>
            </div>
            <span>${metrics.rollingTotal > 0 ? Math.round(metrics.rollingPrecision * 100) + '%' : '--'}</span>
          </div>
          <div class="gauge" style="margin-top:8px;">
            <span>Recall</span>
            <div class="gauge-bar">
              <div class="gauge-fill" style="width:${Math.round(metrics.rollingRecall * 100)}%;background:var(--blue)"></div>
            </div>
            <span>${metrics.rollingTotal > 0 ? Math.round(metrics.rollingRecall * 100) + '%' : '--'}</span>
          </div>
          <div style="margin-top:12px;font-size:13px;color:var(--text-muted);">
            Rolling window: ${metrics.rollingTotal}/50 entries |
            Review-ignored passes: ${metrics.reviewIgnoredPasses}
            ${metrics.lastReviewIgnored ? ` | Last: ${metrics.lastReviewIgnored}` : ''}
          </div>
        </div>
      </div>

      <div class="card">
        <h2 style="font-size:16px;margin-bottom:4px;">Lifetime Accuracy</h2>
        <div style="font-size:12px;color:var(--text-dim);margin-bottom:12px;">Signals from review sessions</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;text-align:center;">
          <div><div style="font-size:24px;font-weight:700;color:var(--green)">${metrics.lifetime.tp}</div><div class="stat-label">TP</div></div>
          <div><div style="font-size:24px;font-weight:700;color:var(--red)">${metrics.lifetime.fp}</div><div class="stat-label">FP</div></div>
          <div><div style="font-size:24px;font-weight:700;color:var(--blue)">${metrics.lifetime.tn}</div><div class="stat-label">TN</div></div>
          <div><div style="font-size:24px;font-weight:700;color:var(--yellow)">${metrics.lifetime.fn}</div><div class="stat-label">FN</div></div>
        </div>
        <div style="margin-top:12px;font-size:13px;color:var(--text-muted);">
          ${metrics.lifetimeTotal} total signals |
          Precision: ${Math.round(metrics.lifetimePrecision * 100)}% |
          Recall: ${Math.round(metrics.lifetimeRecall * 100)}%
        </div>
      </div>
    </div>

    ${metrics.rollingTotal > 0 ? `
    <div class="card" style="margin-top:16px;">
      <h2 style="font-size:16px;margin-bottom:12px;">Recent Activity</h2>
      <div class="article-list" style="max-height:300px;">
        ${stats.rolling_window.slice(-10).reverse().map((e) => {
          const colors: Record<string, string> = { tp: 'var(--green)', fp: 'var(--red)', tn: 'var(--blue)', fn: 'var(--yellow)' };
          return `<div class="article-item">
            <div class="title">${esc(e.title)}</div>
            <div class="meta">
              <span style="color:${colors[e.signal] || 'var(--text-muted)'};font-weight:600">${esc(e.signal.toUpperCase())}</span>
              &middot; ${esc(e.source)} &middot; ${esc(e.date)}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
  `;

  return c.html(layout({ title: 'Dashboard', content, activeNav: 'dashboard' }));
});

export default app;
