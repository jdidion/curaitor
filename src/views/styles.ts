export const CSS = `
:root {
  --bg: #0f0f13;
  --bg-card: #1a1a24;
  --bg-hover: #242434;
  --bg-input: #12121a;
  --border: #2a2a3a;
  --text: #e4e4ef;
  --text-muted: #8888a0;
  --text-dim: #555568;
  --accent: #6366f1;
  --accent-hover: #818cf8;
  --green: #22c55e;
  --yellow: #eab308;
  --red: #ef4444;
  --blue: #3b82f6;
  --purple: #a855f7;
  --radius: 8px;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --mono: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
}

a { color: var(--accent); text-decoration: none; }
a:hover { color: var(--accent-hover); }

.container { max-width: 1400px; margin: 0 auto; padding: 0 24px; }

/* Navigation */
nav {
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 32px;
  height: 56px;
  position: sticky;
  top: 0;
  z-index: 100;
}
nav .logo { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 18px; }
nav .logo img { width: 28px; height: 28px; }
nav a.nav-link {
  color: var(--text-muted);
  font-size: 14px;
  padding: 16px 0;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}
nav a.nav-link:hover, nav a.nav-link.active {
  color: var(--text);
  border-bottom-color: var(--accent);
}
nav .nav-badge {
  background: var(--accent);
  color: white;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  margin-left: 4px;
}

/* Cards */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin: 24px 0;
}
.stat-card { text-align: center; }
.stat-card .stat-value { font-size: 36px; font-weight: 700; }
.stat-card .stat-label { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

/* Metric gauge */
.gauge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.gauge-bar {
  width: 100px;
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}
.gauge-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}

/* Two-pane layout */
.two-pane {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 20px;
  margin-top: 24px;
  min-height: calc(100vh - 120px);
}
.article-list {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow-y: auto;
  max-height: calc(100vh - 120px);
}
.article-item {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.1s;
}
.article-item:hover, .article-item.active { background: var(--bg-hover); }
.article-item .title { font-size: 14px; font-weight: 500; }
.article-item .meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.article-item .tag {
  display: inline-block;
  font-size: 11px;
  background: var(--bg);
  color: var(--text-muted);
  padding: 1px 8px;
  border-radius: 4px;
  margin: 2px 2px 0 0;
}

/* Article detail */
.article-detail {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
  overflow-y: auto;
  max-height: calc(100vh - 120px);
}
.article-detail h1 { font-size: 22px; margin-bottom: 8px; }
.article-detail .meta-row {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 16px;
}
.article-detail .section { margin: 16px 0; }
.article-detail .section h2 {
  font-size: 14px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

/* Verdict bar */
.verdict-bar {
  display: flex;
  gap: 8px;
  padding: 16px 0;
  border-top: 1px solid var(--border);
  margin-top: 20px;
  flex-wrap: wrap;
}
.verdict-btn {
  padding: 6px 16px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: var(--font);
}
.verdict-btn:hover { background: var(--bg-hover); border-color: var(--accent); }
.verdict-btn.primary { background: var(--accent); border-color: var(--accent); color: white; }
.verdict-btn .key {
  display: inline-block;
  background: var(--bg-card);
  padding: 0 4px;
  border-radius: 3px;
  font-family: var(--mono);
  font-size: 12px;
  margin-right: 4px;
}

/* Grouped list (for ignored/recycle) */
.group { margin: 20px 0; }
.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius) var(--radius) 0 0;
  font-weight: 500;
}
.group-header .count { color: var(--text-muted); font-size: 13px; }
.group-items {
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 var(--radius) var(--radius);
}

/* Section header */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 24px 0 0;
}
.page-header h1 { font-size: 24px; }

/* Buttons */
.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text);
  font-family: var(--font);
  transition: all 0.15s;
}
.btn:hover { background: var(--bg-hover); }
.btn-accent { background: var(--accent); border-color: var(--accent); color: white; }
.btn-accent:hover { background: var(--accent-hover); }
.btn-danger { border-color: var(--red); color: var(--red); }
.btn-danger:hover { background: var(--red); color: white; }
.btn-sm { padding: 4px 10px; font-size: 12px; }

/* Toast */
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: var(--bg-card);
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  padding: 12px 20px;
  font-size: 14px;
  z-index: 200;
  animation: fadeIn 0.2s;
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; } }

/* Settings tabs */
.tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 20px;
}
.tab {
  padding: 10px 20px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
}
.tab:hover, .tab.active { color: var(--text); border-bottom-color: var(--accent); }
textarea.config-editor {
  width: 100%;
  min-height: 400px;
  background: var(--bg-input);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
}

/* Responsive */
@media (max-width: 900px) {
  .two-pane { grid-template-columns: 1fr; }
  .card-grid { grid-template-columns: repeat(2, 1fr); }
}
`;
