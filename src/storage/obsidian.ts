import { readdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join, relative } from 'path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import type { StorageBackend, Article, RecycleEntry, AccuracyStats, FolderName, ConfigKey } from './types.js';

/** Convert Date objects (from gray-matter) to YYYY-MM-DD strings. */
function toStr(val: unknown): string {
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === 'string') return val;
  return val ? String(val) : '';
}

function extractSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let current: string | null = null;
  const lines: string[] = [];

  for (const line of body.split('\n')) {
    if (line.startsWith('## ')) {
      if (current) sections[current] = lines.join('\n').trim();
      current = line.slice(3).trim().toLowerCase();
      lines.length = 0;
    } else if (current) {
      lines.push(line);
    }
  }
  if (current) sections[current] = lines.join('\n').trim();
  return sections;
}

function extractBullets(text: string): string[] {
  return text
    .split('\n')
    .filter((l) => l.trim().startsWith('- '))
    .map((l) => l.trim().slice(2));
}

function parseArticle(content: string, filename: string, relPath: string, folder: FolderName): Article {
  const { data: fm, content: body } = matter(content);
  const sections = extractSections(body);

  return {
    id: filename,
    filename,
    folder,
    title: fm.title || filename.replace('.md', ''),
    url: fm.url || '',
    source: fm.source || '',
    category: fm.category || 'general',
    confidence: fm.confidence || '',
    verdict: fm.verdict || '',
    tags: Array.isArray(fm.tags) ? fm.tags : fm.tags ? [fm.tags] : [],
    dateSaved: toStr(fm.date_saved),
    dateTriaged: toStr(fm.date_triaged) || '',
    bookmarkId: fm.bookmark_id,
    mediaType: fm.media_type,
    reviewedIgnored: fm.reviewed_ignored,
    reviewDecision: fm.review_decision,
    autonomyLevel: fm.autonomy_level,
    summary: sections.summary || '',
    whyReview: sections['why review?'] || sections['verdict'] || '',
    verdictText: sections['verdict'] || '',
    takeaways: extractBullets(sections['key takeaways'] || ''),
    body,
  };
}

function buildFrontmatter(article: Partial<Article>): Record<string, unknown> {
  const fm: Record<string, unknown> = {};
  if (article.title) fm.title = article.title;
  if (article.url) fm.url = article.url;
  if (article.source) fm.source = article.source;
  if (article.dateTriaged) fm.date_triaged = article.dateTriaged;
  if (article.category) fm.category = article.category;
  if (article.confidence) fm.confidence = article.confidence;
  if (article.verdict) fm.verdict = article.verdict;
  if (article.tags?.length) fm.tags = article.tags;
  if (article.bookmarkId) fm.bookmark_id = article.bookmarkId;
  if (article.dateSaved) fm.date_saved = article.dateSaved;
  if (article.mediaType) fm.media_type = article.mediaType;
  if (article.reviewedIgnored) fm.reviewed_ignored = article.reviewedIgnored;
  if (article.reviewDecision) fm.review_decision = article.reviewDecision;
  if (article.autonomyLevel !== undefined) fm.autonomy_level = article.autonomyLevel;
  return fm;
}

export class ObsidianBackend implements StorageBackend {
  private folders: Record<FolderName, string>;
  private recyclePath: string;
  private configPaths: Record<ConfigKey, string>;

  constructor(
    private vaultPath: string,
    private pluginPath: string,
  ) {
    this.folders = {
      inbox: join(vaultPath, 'Curaitor/Inbox'),
      review: join(vaultPath, 'Curaitor/Review'),
      ignored: join(vaultPath, 'Curaitor/Ignored'),
      archive: join(vaultPath, 'Curaitor/Archive'),
      library: join(vaultPath, 'Library'),
      topics: join(vaultPath, 'Topics'),
    };
    this.recyclePath = join(vaultPath, 'Curaitor/Recycle.md');
    this.configPaths = {
      feeds: join(pluginPath, 'config/feeds.yaml'),
      prefs: join(pluginPath, 'config/reading-prefs.md'),
      rules: join(pluginPath, 'config/triage-rules.yaml'),
      accuracyStats: join(pluginPath, 'config/accuracy-stats.yaml'),
    };
  }

  // --- Articles ---

  listArticles(folder: FolderName): Article[] {
    const dir = this.folders[folder];
    if (!existsSync(dir)) return [];

    return readdirSync(dir)
      .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
      .map((f) => {
        const content = readFileSync(join(dir, f), 'utf-8');
        const relPath = relative(this.vaultPath, join(dir, f));
        return parseArticle(content, f, relPath, folder);
      })
      .sort((a, b) => (b.dateTriaged || '').localeCompare(a.dateTriaged || ''));
  }

  getArticle(folder: FolderName, id: string): Article | null {
    const filepath = join(this.folders[folder], id);
    if (!existsSync(filepath)) return null;
    const content = readFileSync(filepath, 'utf-8');
    return parseArticle(content, id, relative(this.vaultPath, filepath), folder);
  }

  createArticle(folder: FolderName, article: Partial<Article>): Article {
    const dir = this.folders[folder];
    mkdirSync(dir, { recursive: true });

    const fm = buildFrontmatter(article);
    const bodyParts: string[] = [];
    if (article.summary) bodyParts.push(`## Summary\n${article.summary}`);
    if (article.verdictText) bodyParts.push(`## Verdict\n${article.verdictText}`);
    if (article.whyReview) bodyParts.push(`## Why Review?\n${article.whyReview}`);
    if (article.takeaways?.length) bodyParts.push(`## Key Takeaways\n${article.takeaways.map((t) => `- ${t}`).join('\n')}`);
    const bodyContent = article.body || (bodyParts.length ? '\n' + bodyParts.join('\n\n') + '\n' : '\n');

    const markdown = matter.stringify(bodyContent, fm);
    const filename = article.id || `${(article.title || 'untitled').replace(/[/\\:*?"<>|]/g, '-')}.md`;
    const filepath = join(dir, filename);
    writeFileSync(filepath, markdown);

    return parseArticle(markdown, filename, relative(this.vaultPath, filepath), folder);
  }

  moveArticle(fromFolder: FolderName, toFolder: FolderName, id: string): void {
    const src = join(this.folders[fromFolder], id);
    const dest = join(this.folders[toFolder], id);
    mkdirSync(this.folders[toFolder], { recursive: true });
    renameSync(src, dest);
  }

  deleteArticle(folder: FolderName, id: string): void {
    const filepath = join(this.folders[folder], id);
    if (existsSync(filepath)) unlinkSync(filepath);
  }

  updateArticle(folder: FolderName, id: string, updates: Partial<Article>): void {
    const filepath = join(this.folders[folder], id);
    if (!existsSync(filepath)) return;

    const raw = readFileSync(filepath, 'utf-8');
    const { data: fm, content } = matter(raw);

    const mapped = buildFrontmatter(updates);
    Object.assign(fm, mapped);

    const updated = matter.stringify(content, fm);
    writeFileSync(filepath, updated);
  }

  folderCount(folder: FolderName): number {
    const dir = this.folders[folder];
    if (!existsSync(dir)) return 0;
    return readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('.')).length;
  }

  allFolderCounts(): Record<FolderName, number> {
    return {
      inbox: this.folderCount('inbox'),
      review: this.folderCount('review'),
      ignored: this.folderCount('ignored'),
      archive: this.folderCount('archive'),
      library: this.folderCount('library'),
      topics: this.folderCount('topics'),
    };
  }

  // --- Recycle ---

  loadRecycle(): RecycleEntry[] {
    if (!existsSync(this.recyclePath)) return [];
    const content = readFileSync(this.recyclePath, 'utf-8');
    const entries: RecycleEntry[] = [];
    let currentCategory = 'Uncategorized';

    for (const line of content.split('\n')) {
      if (line.startsWith('## ')) {
        currentCategory = line.slice(3).trim();
      } else if (line.trim().startsWith('- [')) {
        const m = line.match(/- \[(.+?)\]\((.+?)\)(.*)$/);
        if (m) {
          entries.push({
            title: m[1],
            url: m[2],
            category: currentCategory,
            isDuplicate: m[3]?.includes('(duplicate)') || false,
          });
        }
      }
    }
    return entries;
  }

  appendRecycle(title: string, url: string, tag?: string): void {
    const suffix = tag ? ` (${tag})` : '';
    const line = `- [${title}](${url})${suffix}\n`;

    if (!existsSync(this.recyclePath)) {
      writeFileSync(this.recyclePath, `# Recycle\n\nConfirmed ignored articles — reviewed and not worth keeping.\n\n${line}`);
    } else {
      const content = readFileSync(this.recyclePath, 'utf-8');
      writeFileSync(this.recyclePath, content.trimEnd() + '\n' + line);
    }
  }

  clearRecycle(): void {
    writeFileSync(this.recyclePath, '# Recycle\n\nConfirmed ignored articles — reviewed and not worth keeping.\n');
  }

  recycleCount(): number {
    return this.loadRecycle().length;
  }

  // --- Metrics ---

  loadStats(): AccuracyStats {
    const path = this.configPaths.accuracyStats;
    if (!existsSync(path)) {
      return {
        autonomy_level: 0,
        lifetime: {
          instapaper: { tp: 0, fp: 0, tn: 0, fn: 0 },
          rss: { tp: 0, fp: 0, tn: 0, fn: 0 },
        },
        rolling_window: [],
        review_ignored_passes: 0,
        last_review_ignored: null,
      };
    }
    return yaml.load(readFileSync(path, 'utf-8')) as AccuracyStats;
  }

  saveStats(stats: AccuracyStats): void {
    writeFileSync(this.configPaths.accuracyStats, yaml.dump(stats, { sortKeys: false }));
  }

  // --- Config ---

  readConfig(key: ConfigKey): string {
    const path = this.configPaths[key];
    if (!existsSync(path)) return '';
    return readFileSync(path, 'utf-8');
  }

  writeConfig(key: ConfigKey, content: string): void {
    writeFileSync(this.configPaths[key], content);
  }
}
