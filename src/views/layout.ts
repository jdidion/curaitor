import { CSS } from './styles.js';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', key: 'dashboard' },
  { label: 'Review', href: '/review', key: 'review' },
  { label: 'Read', href: '/read', key: 'read' },
  { label: 'Ignored', href: '/ignored', key: 'ignored' },
  { label: 'Recycle', href: '/recycle', key: 'recycle' },
  { label: 'Links', href: '/links', key: 'links' },
  { label: 'Topics', href: '/topics', key: 'topics' },
  { label: 'Settings', href: '/settings', key: 'settings' },
];

export function layout(opts: {
  title: string;
  content: string;
  activeNav?: string;
  navCounts?: Record<string, number>;
}): string {
  const { title, content, activeNav, navCounts } = opts;

  const navLinks = NAV_ITEMS.map((item) => {
    const active = activeNav === item.key ? ' active' : '';
    const count = navCounts?.[item.key];
    const badge = count ? `<span class="nav-badge">${count}</span>` : '';
    return `<a class="nav-link${active}" href="${item.href}">${item.label}${badge}</a>`;
  }).join('\n      ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#0f0f13">
  <title>${title} - CurAItor</title>
  <style>${CSS}</style>
</head>
<body>
  <nav>
    <a class="logo" href="/">
      <img src="/public/logo.svg" alt="CurAItor">
      <span>CurAItor</span>
    </a>
    <div style="display:flex;gap:24px;align-items:center;">
      ${navLinks}
    </div>
  </nav>
  <main class="container">
    ${content}
  </main>
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.8/dist/cdn.min.js"></script>
</body>
</html>`;
}
