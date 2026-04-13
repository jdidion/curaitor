import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { PORT, VAULT_PATH } from './config.js';
import dashboard from './routes/dashboard.js';
import review from './routes/review.js';
import read from './routes/read.js';
import ignored from './routes/ignored.js';
import recycle from './routes/recycle.js';
import settings from './routes/settings.js';

const app = new Hono();

app.use('/public/*', serveStatic({ root: './' }));

app.route('/', dashboard);
app.route('/review', review);
app.route('/read', read);
app.route('/ignored', ignored);
app.route('/recycle', recycle);
app.route('/settings', settings);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Curaitor running at http://localhost:${info.port}`);
  console.log(`Vault: ${VAULT_PATH}`);
});
