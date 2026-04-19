import { readdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join, relative } from 'path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import type { StorageBackend, Article, RecycleEntry, AccuracyStats, FolderName, ConfigKey, Link, LinkType, LinkBackend, Topic } from './types.js';

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

/** Resolve the links markdown file, checking primary then legacy paths. */
function resolveLinksPath(vaultPath: string): { path: string; readOnly: boolean } {
  const primary = join(vaultPath, 'Links.md');
  if (existsSync(primary)) return { path: primary, readOnly: false };

  for (const legacy of ['Tools & Projects.md', 'Bookmarks.md']) {
    const p = join(vaultPath, legacy);
    if (existsSync(p)) return { path: p, readOnly: true };
  }
  return { path: primary, readOnly: false };
}

/** Parse a single link line: `- [title](url) — description | type | tag1,tag2` with optional `topics:t1,t2` suffix */
function parseLinkLine(line: string, category: string): Link | null {
  const m = line.match(/^-\s+\[(.+?)\]\((.+?)\)\s*(?:—\s*(.*))?$/);
  if (!m) return null;

  const title = m[1];
  const url = m[2];
  const rest = (m[3] || '').trim();

  const parts = rest.split('|').map((s) => s.trim());
  const description = parts[0] || '';
  const type = (parts[1] as LinkType) || 'article';
  const tagsPart = parts[2] || '';

  let topicIds: string[] = [];
  let tagsStr = tagsPart;
  const topicsMatch = tagsPart.match(/topics:(.+)$/);
  if (topicsMatch) {
    topicIds = topicsMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    tagsStr = tagsPart.slice(0, topicsMatch.index).replace(/,\s*$/, '');
  }

  const tags = tagsStr.split(',').map((s) => s.trim()).filter(Boolean);
  const id = url.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 80);

  return {
    id,
    url,
    title,
    type,
    backend: 'obsidian' as LinkBackend,
    category,
    tags,
    description,
    dateAdded: '',
    topicIds,
  };
}

/** Format a Link as a markdown list entry for Links.md */
function formatLinkLine(link: Link): string {
  const parts = [link.description || ''];
  if (link.type && link.type !== 'article') parts.push(link.type);
  else parts.push('');
  const tagStr = link.tags.length ? link.tags.join(',') : '';
  const topicStr = link.topicIds.length ? `topics:${link.topicIds.join(',')}` : '';
  const suffix = topicStr ? (tagStr ? `${tagStr},${topicStr}` : topicStr) : tagStr;
  parts.push(suffix);

  const meta = parts.map((p) => p.trim()).join(' | ').replace(/\|\s*$/, '').trim();
  const desc = meta ? ` — ${meta}` : '';
  return `- [${link.title}](${link.url})${desc}`;
}

/** Parse a topic markdown file into a Topic object */
function parseTopic(content: string, filename: string): Topic {
  const { data: fm, content: body } = matter(content);
  const sections = extractSections(body);
  const linkLines = (sections.links || '').split('\n').filter((l) => l.trim().startsWith('- '));

  return {
    id: filename.replace('.md', ''),
    name: fm.name || filename.replace('.md', ''),
    description: fm.description || '',
    tags: Array.isArray(fm.tags) ? fm.tags : fm.tags ? [fm.tags] : [],
    summary: sections.summary || '',
    linkCount: linkLines.length,
    dateCreated: toStr(fm.date_created),
    dateUpdated: toStr(fm.date_updated),
  };
}

export class ObsidianBackend implements StorageBackend {
  private folders: Record<FolderName, string>;
  private recyclePath: string;
  private topicsDir: string;
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
    this.topicsDir = join(vaultPath, 'Topics');
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
      .reduce<Article[]>((acc, f) => {
        try {
          const content = readFileSync(join(dir, f), 'utf-8');
          const relPath = relative(this.vaultPath, join(dir, f));
          acc.push(parseArticle(content, f, relPath, folder));
        } catch (err) {
          console.warn(`Skipping malformed article ${f}: ${(err as Error).message}`);
        }
        return acc;
      }, [])
      .sort((a, b) => (b.dateTriaged || '').localeCompare(a.dateTriaged || ''));
  }

  getArticle(folder: FolderName, id: string): Article | null {
    const filepath = join(this.folders[folder], id);
    if (!existsSync(filepath)) return null;
    let content: string;
    try {
      content = readFileSync(filepath, 'utf-8');
    } catch { return null; }
    try {
      return parseArticle(content, id, relative(this.vaultPath, filepath), folder);
    } catch (err) {
      console.warn(`Malformed article ${id}: ${(err as Error).message}`);
      return null;
    }
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
        max_error_rate: 0.05,
        fn_weight: 2,
        fp_weight: 1,
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

  // --- Links ---

  private resolveLinks(): { path: string; readOnly: boolean } {
    return resolveLinksPath(this.vaultPath);
  }

  private readLinksFile(): { content: string; path: string; readOnly: boolean } {
    const resolved = this.resolveLinks();
    if (!existsSync(resolved.path)) return { content: '', path: resolved.path, readOnly: resolved.readOnly };
    return { content: readFileSync(resolved.path, 'utf-8'), path: resolved.path, readOnly: resolved.readOnly };
  }

  private parseAllLinks(): Link[] {
    const { content } = this.readLinksFile();
    if (!content) return [];

    const links: Link[] = [];
    let category = '';

    for (const line of content.split('\n')) {
      if (line.startsWith('## ')) {
        category = line.slice(3).trim();
      } else if (line.trim().startsWith('- [')) {
        const link = parseLinkLine(line.trim(), category);
        if (link) links.push(link);
      }
    }
    return links;
  }

  listLinks(opts?: { topicId?: string; type?: LinkType; category?: string; backend?: LinkBackend }): Link[] {
    let links = this.parseAllLinks();

    if (opts?.topicId) {
      links = links.filter((l) => l.topicIds.includes(opts.topicId!));
    }
    if (opts?.type) {
      links = links.filter((l) => l.type === opts.type);
    }
    if (opts?.category) {
      links = links.filter((l) => l.category.toLowerCase().includes(opts.category!.toLowerCase()));
    }
    if (opts?.backend) {
      links = links.filter((l) => l.backend === opts.backend);
    }
    return links;
  }

  getLink(id: string): Link | null {
    return this.parseAllLinks().find((l) => l.id === id) ?? null;
  }

  createLink(link: Partial<Link>): Link {
    const { path, readOnly } = this.resolveLinks();
    if (readOnly) {
      throw new Error(`Cannot write to legacy links file: ${path}`);
    }

    const today = new Date().toISOString().slice(0, 10);
    const full: Link = {
      id: (link.url || '').replace(/[^a-zA-Z0-9]/g, '-').slice(0, 80),
      url: link.url || '',
      title: link.title || '',
      type: link.type || 'article',
      backend: 'obsidian',
      category: link.category || '',
      tags: link.tags || [],
      description: link.description || '',
      dateAdded: link.dateAdded || today,
      topicIds: link.topicIds || [],
      externalId: link.externalId,
    };

    const newLine = formatLinkLine(full);
    const category = full.category || 'Uncategorized';

    if (!existsSync(path)) {
      writeFileSync(path, `# Links\n\n## ${category}\n${newLine}\n`);
      return full;
    }

    const content = readFileSync(path, 'utf-8');
    const lines = content.split('\n');
    let inserted = false;

    // Find the matching category heading and append after its entries
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('## ') && lines[i].slice(3).trim() === category) {
        // Find the end of this category's entries
        let j = i + 1;
        while (j < lines.length && !lines[j].startsWith('## ') && !lines[j].startsWith('# ')) {
          j++;
        }
        // Insert before the next heading, after last non-blank line
        let insertAt = j;
        while (insertAt > i + 1 && lines[insertAt - 1].trim() === '') {
          insertAt--;
        }
        lines.splice(insertAt, 0, newLine);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      // Append new category at end
      const trailing = lines[lines.length - 1]?.trim() === '' ? '' : '\n';
      lines.push(`${trailing}\n## ${category}`, newLine);
    }

    writeFileSync(path, lines.join('\n'));
    return full;
  }

  updateLink(id: string, updates: Partial<Link>): void {
    const { path, readOnly } = this.resolveLinks();
    if (readOnly || !existsSync(path)) return;

    const content = readFileSync(path, 'utf-8');
    const lines = content.split('\n');
    let category = '';

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) {
        category = lines[i].slice(3).trim();
      } else if (lines[i].trim().startsWith('- [')) {
        const link = parseLinkLine(lines[i].trim(), category);
        if (link && link.id === id) {
          const merged: Link = { ...link, ...updates };
          lines[i] = formatLinkLine(merged);
          writeFileSync(path, lines.join('\n'));
          return;
        }
      }
    }
  }

  deleteLink(id: string): void {
    const { path, readOnly } = this.resolveLinks();
    if (readOnly || !existsSync(path)) return;

    const content = readFileSync(path, 'utf-8');
    const lines = content.split('\n');
    let category = '';

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) {
        category = lines[i].slice(3).trim();
      } else if (lines[i].trim().startsWith('- [')) {
        const link = parseLinkLine(lines[i].trim(), category);
        if (link && link.id === id) {
          lines.splice(i, 1);
          writeFileSync(path, lines.join('\n'));
          return;
        }
      }
    }
  }

  linkCount(): number {
    return this.parseAllLinks().length;
  }

  // --- Topics ---

  listTopics(): Topic[] {
    if (!existsSync(this.topicsDir)) return [];

    return readdirSync(this.topicsDir)
      .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
      .map((f) => {
        const content = readFileSync(join(this.topicsDir, f), 'utf-8');
        return parseTopic(content, f);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  getTopic(id: string): Topic | null {
    const filename = id.endsWith('.md') ? id : `${id}.md`;
    const filepath = join(this.topicsDir, filename);
    if (!existsSync(filepath)) return null;
    const content = readFileSync(filepath, 'utf-8');
    return parseTopic(content, filename);
  }

  createTopic(topic: Partial<Topic>): Topic {
    mkdirSync(this.topicsDir, { recursive: true });

    const today = new Date().toISOString().slice(0, 10);
    const name = topic.name || 'Untitled Topic';
    const id = topic.id || name.replace(/[/\\:*?"<>|]/g, '-');
    const filename = `${id}.md`;

    const fm: Record<string, unknown> = {
      name,
      description: topic.description || '',
      tags: topic.tags || [],
      date_created: topic.dateCreated || today,
      date_updated: topic.dateUpdated || today,
    };

    const bodyParts: string[] = [];
    if (topic.summary) bodyParts.push(`## Summary\n${topic.summary}`);
    bodyParts.push('## Links');
    const bodyContent = '\n' + bodyParts.join('\n\n') + '\n';

    const markdown = matter.stringify(bodyContent, fm);
    writeFileSync(join(this.topicsDir, filename), markdown);

    return {
      id,
      name,
      description: fm.description as string,
      tags: fm.tags as string[],
      summary: topic.summary || '',
      linkCount: 0,
      dateCreated: fm.date_created as string,
      dateUpdated: fm.date_updated as string,
    };
  }

  updateTopic(id: string, updates: Partial<Topic>): void {
    const filename = id.endsWith('.md') ? id : `${id}.md`;
    const filepath = join(this.topicsDir, filename);
    if (!existsSync(filepath)) return;

    const raw = readFileSync(filepath, 'utf-8');
    const { data: fm, content } = matter(raw);

    if (updates.name !== undefined) fm.name = updates.name;
    if (updates.description !== undefined) fm.description = updates.description;
    if (updates.tags !== undefined) fm.tags = updates.tags;
    fm.date_updated = new Date().toISOString().slice(0, 10);

    if (updates.summary !== undefined) {
      // Replace summary section in body
      const lines = content.split('\n');
      let inSummary = false;
      const newLines: string[] = [];
      let summaryReplaced = false;
      for (const line of lines) {
        if (line.startsWith('## Summary')) {
          inSummary = true;
          summaryReplaced = true;
          newLines.push('## Summary');
          newLines.push(updates.summary);
          continue;
        }
        if (inSummary && line.startsWith('## ')) {
          inSummary = false;
        }
        if (!inSummary) {
          newLines.push(line);
        }
      }
      if (!summaryReplaced) {
        newLines.unshift('', '## Summary', updates.summary);
      }
      writeFileSync(filepath, matter.stringify(newLines.join('\n'), fm));
      return;
    }

    writeFileSync(filepath, matter.stringify(content, fm));
  }

  deleteTopic(id: string): void {
    const filename = id.endsWith('.md') ? id : `${id}.md`;
    const filepath = join(this.topicsDir, filename);
    if (existsSync(filepath)) unlinkSync(filepath);
  }

  getTopicLinks(topicId: string): Link[] {
    const filename = topicId.endsWith('.md') ? topicId : `${topicId}.md`;
    const filepath = join(this.topicsDir, filename);
    if (!existsSync(filepath)) return [];

    const raw = readFileSync(filepath, 'utf-8');
    const { content: body } = matter(raw);
    const sections = extractSections(body);
    const linksSection = sections.links || '';

    // Extract link references from topic file
    const allLinks = this.parseAllLinks();
    const topicLinkNames = new Set<string>();

    for (const line of linksSection.split('\n')) {
      // Match wiki-link style: `- [[Name]]`
      const wikiMatch = line.match(/\[\[(.+?)\]\]/);
      if (wikiMatch) {
        topicLinkNames.add(wikiMatch[1].toLowerCase());
        continue;
      }
      // Match markdown link style: `- [Name](url)`
      const mdMatch = line.match(/\[(.+?)\]\((.+?)\)/);
      if (mdMatch) {
        topicLinkNames.add(mdMatch[1].toLowerCase());
      }
    }

    // Also find links that reference this topic in their topicIds
    const byTopicId = allLinks.filter((l) => l.topicIds.includes(topicId));
    const byName = allLinks.filter((l) => topicLinkNames.has(l.title.toLowerCase()));

    // Merge, deduplicate by id
    const seen = new Set<string>();
    const result: Link[] = [];
    for (const link of [...byTopicId, ...byName]) {
      if (!seen.has(link.id)) {
        seen.add(link.id);
        result.push(link);
      }
    }
    return result;
  }

  addLinkToTopic(linkId: string, topicId: string): void {
    const link = this.getLink(linkId);
    if (!link) return;

    // Update topic file: add link to ## Links section
    const topicFilename = topicId.endsWith('.md') ? topicId : `${topicId}.md`;
    const topicPath = join(this.topicsDir, topicFilename);
    if (existsSync(topicPath)) {
      const raw = readFileSync(topicPath, 'utf-8');
      const { data: fm, content } = matter(raw);
      const lines = content.split('\n');
      let linksIdx = lines.findIndex((l) => l.startsWith('## Links'));

      if (linksIdx === -1) {
        lines.push('', '## Links');
        linksIdx = lines.length - 1;
      }

      // Find end of links section
      let insertAt = linksIdx + 1;
      while (insertAt < lines.length && !lines[insertAt].startsWith('## ')) {
        insertAt++;
      }
      // Back up past blank lines
      while (insertAt > linksIdx + 1 && lines[insertAt - 1].trim() === '') {
        insertAt--;
      }

      const linkLine = `- [[${link.title}]] — ${link.description}`;
      lines.splice(insertAt, 0, linkLine);

      fm.date_updated = new Date().toISOString().slice(0, 10);
      writeFileSync(topicPath, matter.stringify(lines.join('\n'), fm));
    }

    // Update link's topic suffix in Links.md
    if (!link.topicIds.includes(topicId)) {
      this.updateLink(linkId, { topicIds: [...link.topicIds, topicId] });
    }
  }

  removeLinkFromTopic(linkId: string, topicId: string): void {
    const link = this.getLink(linkId);
    if (!link) return;

    // Remove from topic file's ## Links section
    const topicFilename = topicId.endsWith('.md') ? topicId : `${topicId}.md`;
    const topicPath = join(this.topicsDir, topicFilename);
    if (existsSync(topicPath)) {
      const raw = readFileSync(topicPath, 'utf-8');
      const { data: fm, content } = matter(raw);
      const lines = content.split('\n');
      const titleLower = link.title.toLowerCase();

      const filtered = lines.filter((line) => {
        const wikiMatch = line.match(/\[\[(.+?)\]\]/);
        if (wikiMatch && wikiMatch[1].toLowerCase() === titleLower) return false;
        const mdMatch = line.match(/\[(.+?)\]\(/);
        if (mdMatch && mdMatch[1].toLowerCase() === titleLower) return false;
        return true;
      });

      fm.date_updated = new Date().toISOString().slice(0, 10);
      writeFileSync(topicPath, matter.stringify(filtered.join('\n'), fm));
    }

    // Remove topic from link's topicIds in Links.md
    if (link.topicIds.includes(topicId)) {
      this.updateLink(linkId, { topicIds: link.topicIds.filter((t) => t !== topicId) });
    }
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
