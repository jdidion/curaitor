import { Hono } from 'hono';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { CONFIG } from '../config.js';
import { layout } from '../views/layout.js';

const app = new Hono();

function readConfig(path: string): string {
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf-8');
}

app.get('/', (c) => {
  const feeds = readConfig(CONFIG.feeds);
  const prefs = readConfig(CONFIG.readingPrefs);
  const rules = readConfig(CONFIG.triageRules);

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

app.post('/feeds', async (c) => {
  const body = await c.req.parseBody();
  writeFileSync(CONFIG.feeds, body['content'] as string);
  c.header('HX-Trigger', 'configSaved');
  return c.html('<div class="toast">Feeds saved</div>');
});

app.post('/prefs', async (c) => {
  const body = await c.req.parseBody();
  writeFileSync(CONFIG.readingPrefs, body['content'] as string);
  c.header('HX-Trigger', 'configSaved');
  return c.html('<div class="toast">Preferences saved</div>');
});

app.post('/rules', async (c) => {
  const body = await c.req.parseBody();
  writeFileSync(CONFIG.triageRules, body['content'] as string);
  c.header('HX-Trigger', 'configSaved');
  return c.html('<div class="toast">Triage rules saved</div>');
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default app;
