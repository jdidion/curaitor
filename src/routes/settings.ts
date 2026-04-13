import { Hono } from 'hono';
import { getBackend } from '../storage/index.js';
import { layout } from '../views/layout.js';
import type { ConfigKey } from '../storage/types.js';

const app = new Hono();

app.get('/', (c) => {
  const backend = getBackend();
  const feeds = backend.readConfig('feeds');
  const prefs = backend.readConfig('prefs');
  const rules = backend.readConfig('rules');

  const content = `
    <div class="page-header"><h1>Settings</h1></div>
    <div style="margin-top:20px">
      <div x-data="{ tab: 'feeds' }">
      <div class="tabs">
        <div class="tab" :class="tab === 'feeds' && 'active'" @click="tab = 'feeds'">Feeds</div>
        <div class="tab" :class="tab === 'prefs' && 'active'" @click="tab = 'prefs'">Preferences</div>
        <div class="tab" :class="tab === 'rules' && 'active'" @click="tab = 'rules'">Triage Rules</div>
      </div>

      <div>
        <div x-show="tab === 'feeds'">
          <form hx-post="/settings/feeds" hx-swap="none">
            <textarea class="config-editor" name="content">${escapeHtml(feeds)}</textarea>
            <div style="margin-top:12px">
              <button class="btn btn-accent" type="submit">Save Feeds</button>
            </div>
          </form>
        </div>

        <div x-show="tab === 'prefs'" style="display:none">
          <form hx-post="/settings/prefs" hx-swap="none">
            <textarea class="config-editor" name="content">${escapeHtml(prefs)}</textarea>
            <div style="margin-top:12px">
              <button class="btn btn-accent" type="submit">Save Preferences</button>
            </div>
          </form>
        </div>

        <div x-show="tab === 'rules'" style="display:none">
          <form hx-post="/settings/rules" hx-swap="none">
            <textarea class="config-editor" name="content">${escapeHtml(rules)}</textarea>
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default app;
