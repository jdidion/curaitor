import { esc } from '../lib/utils.js';
import { Hono } from 'hono';
import { getBackend } from '../storage/index.js';
import { loadCronJobs, updateCronJob, getCronHealth, verifyCronEnvironment } from '../services/cron.js';
import { layout } from '../views/layout.js';
import type { ConfigKey } from '../storage/types.js';

const app = new Hono();

app.get('/', (c) => {
  const backend = getBackend();
  const feeds = backend.readConfig('feeds');
  const prefs = backend.readConfig('prefs');
  const rules = backend.readConfig('rules');
  const jobs = loadCronJobs();
  const health = getCronHealth();
  const verify = verifyCronEnvironment();
  const stats = backend.loadStats();
  const maxErrorRate = stats.max_error_rate ?? 0.05;
  const fnWeight = stats.fn_weight ?? 2;
  const fpWeight = stats.fp_weight ?? 1;

  const cronRows = jobs.map((j) => `
    <div class="card" style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
      <div style="flex:1">
        <div style="font-weight:600;font-size:15px;">${esc(j.label)}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:2px;">
          <code>${esc(j.command)}</code>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <form hx-post="/settings/cron/${j.id}" hx-swap="none" style="display:flex;align-items:center;gap:8px;">
          <input type="text" name="schedule" value="${esc(j.schedule)}"
            style="width:140px;padding:6px 10px;background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:6px;font-family:var(--mono);font-size:13px;" />
          <button type="submit" class="btn btn-sm btn-accent">Save</button>
        </form>
        <button class="btn btn-sm ${j.enabled ? 'btn-danger' : 'btn-accent'}"
          hx-post="/settings/cron/${j.id}/toggle"
          hx-swap="none"
          hx-on::after-request="location.reload()">
          ${j.enabled ? 'Disable' : 'Enable'}
        </button>
      </div>
    </div>
  `).join('');

  const content = `
    <div class="page-header"><h1>Settings</h1></div>
    <div style="margin-top:20px">
      <div x-data="{ tab: 'scheduling' }">
      <div class="tabs">
        <div class="tab" :class="tab === 'scheduling' && 'active'" @click="tab = 'scheduling'">Scheduling</div>
        <div class="tab" :class="tab === 'thresholds' && 'active'" @click="tab = 'thresholds'">Thresholds</div>
        <div class="tab" :class="tab === 'feeds' && 'active'" @click="tab = 'feeds'">Feeds</div>
        <div class="tab" :class="tab === 'prefs' && 'active'" @click="tab = 'prefs'">Preferences</div>
        <div class="tab" :class="tab === 'rules' && 'active'" @click="tab = 'rules'">Triage Rules</div>
      </div>

      <div>
        <div x-show="tab === 'scheduling'">
          <div class="card" style="margin-bottom:16px;display:flex;align-items:center;gap:12px;">
            <span style="font-size:20px;">${verify.ok ? '&#9679;' : '&#9888;'}</span>
            <div>
              <div style="font-weight:500;color:${verify.ok ? 'var(--green)' : 'var(--red)'};">
                ${verify.ok ? 'Claude found' : 'Claude not found'}
              </div>
              <div style="font-size:12px;color:var(--text-muted);">
                ${health.claudePath ? esc(health.claudePath) : 'Not in PATH — cron jobs will fail'}
              </div>
            </div>
          </div>
          <div style="margin-bottom:16px;color:var(--text-muted);font-size:14px;">
            Cron jobs for unattended article processing. Schedules use standard cron syntax.
            Logs capped at 200 lines per run.
          </div>
          ${cronRows}
          <div style="margin-top:16px;font-size:13px;color:var(--text-dim);">
            Common schedules: <code>0 */6 * * *</code> (every 6h) &middot;
            <code>0 6 * * *</code> (daily 6am) &middot;
            <code>0 */2 * * *</code> (every 2h) &middot;
            <code>0 6 * * 1-5</code> (weekdays 6am)
          </div>
        </div>

        <div x-show="tab === 'thresholds'" style="display:none">
          <div style="margin-bottom:16px;color:var(--text-muted);font-size:14px;">
            The autonomy system tracks a weighted error rate over the last 50 reviewed articles.
            Errors are weighted — by default a false negative counts twice as much as a false positive,
            because missing something interesting is worse than surfacing something you skip.
          </div>
          <form hx-post="/settings/thresholds" hx-swap="none" class="card" style="display:flex;flex-direction:column;gap:16px;">
            <div style="display:flex;align-items:center;gap:16px;">
              <label style="width:200px;font-weight:500;">Max Error Rate</label>
              <input type="number" name="max_error_rate" value="${maxErrorRate * 100}" min="0" max="100" step="0.1"
                style="width:100px;padding:6px 10px;background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:6px;font-size:14px;text-align:right;" />
              <span style="color:var(--text-muted);">% (weighted error budget)</span>
            </div>
            <div style="display:flex;align-items:center;gap:16px;">
              <label style="width:200px;font-weight:500;">False Negative Weight</label>
              <input type="number" name="fn_weight" value="${fnWeight}" min="0" max="20" step="0.1"
                style="width:100px;padding:6px 10px;background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:6px;font-size:14px;text-align:right;" />
              <span style="color:var(--text-muted);">× (missed interesting articles)</span>
            </div>
            <div style="display:flex;align-items:center;gap:16px;">
              <label style="width:200px;font-weight:500;">False Positive Weight</label>
              <input type="number" name="fp_weight" value="${fpWeight}" min="0" max="20" step="0.1"
                style="width:100px;padding:6px 10px;background:var(--bg-input);color:var(--text);border:1px solid var(--border);border-radius:6px;font-size:14px;text-align:right;" />
              <span style="color:var(--text-muted);">× (wrongly surfaced articles)</span>
            </div>
            <div style="font-size:13px;color:var(--text-dim);line-height:1.6;">
              <strong>How it works:</strong> each error contributes its weight; the score is normalized by the larger weight
              so the threshold stays interpretable as a fraction of the window (e.g. 5% ≈ 2.5 articles out of 50).
              Demotion triggers when the score exceeds the threshold and the window has ≥20 entries.
              <br><br>
              <strong>Defaults (FN=2, FP=1):</strong> favor recall — the agent errs on the side of surfacing.
              <strong>Set FN=FP=1</strong> to treat errors equally.
              <strong>Raise FN</strong> further to be more sensitive to missed articles during training.
            </div>
            <div><button type="submit" class="btn btn-accent">Save Thresholds</button></div>
          </form>
        </div>

        <div x-show="tab === 'feeds'" style="display:none">
          <form hx-post="/settings/feeds" hx-swap="none">
            <textarea class="config-editor" name="content">${esc(feeds)}</textarea>
            <div style="margin-top:12px">
              <button class="btn btn-accent" type="submit">Save Feeds</button>
            </div>
          </form>
        </div>

        <div x-show="tab === 'prefs'" style="display:none">
          <form hx-post="/settings/prefs" hx-swap="none">
            <textarea class="config-editor" name="content">${esc(prefs)}</textarea>
            <div style="margin-top:12px">
              <button class="btn btn-accent" type="submit">Save Preferences</button>
            </div>
          </form>
        </div>

        <div x-show="tab === 'rules'" style="display:none">
          <form hx-post="/settings/rules" hx-swap="none">
            <textarea class="config-editor" name="content">${esc(rules)}</textarea>
            <div style="margin-top:12px">
              <button class="btn btn-accent" type="submit">Save Rules</button>
            </div>
          </form>
        </div>
      </div>
      </div>
    </div>`;

  return c.html(layout({ title: 'Settings', content, activeNav: 'settings' }));
});

// Config save routes
const CONFIG_MAP: Record<string, ConfigKey> = {
  feeds: 'feeds',
  prefs: 'prefs',
  rules: 'rules',
};

for (const [route, key] of Object.entries(CONFIG_MAP)) {
  app.post(`/${route}`, async (c) => {
    const body = await c.req.parseBody();
    getBackend().writeConfig(key, body['content'] as string);
    c.header('HX-Trigger', 'configSaved');
    return c.html(`<div class="toast">${route.charAt(0).toUpperCase() + route.slice(1)} saved</div>`);
  });
}

// Threshold update
app.post('/thresholds', async (c) => {
  const body = await c.req.parseBody();
  const stats = getBackend().loadStats();
  stats.max_error_rate = parseFloat(body['max_error_rate'] as string) / 100;
  stats.fn_weight = parseFloat(body['fn_weight'] as string);
  stats.fp_weight = parseFloat(body['fp_weight'] as string);
  getBackend().saveStats(stats);
  c.header('HX-Trigger', 'configSaved');
  return c.html('<div class="toast">Thresholds saved</div>');
});

// Cron schedule update
app.post('/cron/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.parseBody();
  const schedule = body['schedule'] as string;
  if (schedule) {
    updateCronJob(id, { schedule });
  }
  c.header('HX-Trigger', 'configSaved');
  return c.html('<div class="toast">Schedule updated</div>');
});

// Cron enable/disable toggle
app.post('/cron/:id/toggle', async (c) => {
  const id = c.req.param('id');
  const jobs = loadCronJobs();
  const job = jobs.find((j) => j.id === id);
  if (job) {
    updateCronJob(id, { enabled: !job.enabled });
  }
  c.header('HX-Trigger', 'configSaved');
  return c.html(`<div class="toast">${id} ${job?.enabled ? 'disabled' : 'enabled'}</div>`);
});


export default app;
