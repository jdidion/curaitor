import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import type {
  Article,
  FolderName,
  ConfigKey,
  RecycleEntry,
  AccuracyStats,
  Link,
  LinkType,
  LinkBackend,
  Topic,
  StorageBackend,
} from './types.js';

const DEFAULT_STATS: AccuracyStats = {
  autonomy_level: 1,
  lifetime: {
    instapaper: { tp: 0, fp: 0, tn: 0, fn: 0 },
    rss: { tp: 0, fp: 0, tn: 0, fn: 0 },
  },
  rolling_window: [],
  review_ignored_passes: 0,
  last_review_ignored: null,
};

function rowToArticle(row: Record<string, unknown>): Article {
  return {
    id: row.id as string,
    filename: row.id as string,
    folder: row.folder as FolderName,
    title: row.title as string,
    url: row.url as string,
    source: row.source as string,
    category: row.category as string,
    confidence: row.confidence as string,
    verdict: row.verdict as string,
    tags: JSON.parse((row.tags as string) || '[]'),
    dateSaved: row.date_saved as string,
    dateTriaged: row.date_triaged as string,
    bookmarkId: row.bookmark_id as number | undefined,
    mediaType: row.media_type as string | undefined,
    reviewedIgnored: row.reviewed_ignored as string | undefined,
    reviewDecision: row.review_decision as string | undefined,
    autonomyLevel: row.autonomy_level as number | undefined,
    summary: row.summary as string,
    whyReview: row.why_review as string,
    verdictText: row.verdict_text as string,
    takeaways: JSON.parse((row.takeaways as string) || '[]'),
    body: row.body as string,
  };
}

function articleToRow(article: Partial<Article>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (article.id !== undefined) row.id = article.id;
  if (article.folder !== undefined) row.folder = article.folder;
  if (article.title !== undefined) row.title = article.title;
  if (article.url !== undefined) row.url = article.url;
  if (article.source !== undefined) row.source = article.source;
  if (article.category !== undefined) row.category = article.category;
  if (article.confidence !== undefined) row.confidence = article.confidence;
  if (article.verdict !== undefined) row.verdict = article.verdict;
  if (article.tags !== undefined) row.tags = JSON.stringify(article.tags);
  if (article.dateSaved !== undefined) row.date_saved = article.dateSaved;
  if (article.dateTriaged !== undefined) row.date_triaged = article.dateTriaged;
  if (article.bookmarkId !== undefined) row.bookmark_id = article.bookmarkId;
  if (article.mediaType !== undefined) row.media_type = article.mediaType;
  if (article.reviewedIgnored !== undefined) row.reviewed_ignored = article.reviewedIgnored;
  if (article.reviewDecision !== undefined) row.review_decision = article.reviewDecision;
  if (article.autonomyLevel !== undefined) row.autonomy_level = article.autonomyLevel;
  if (article.summary !== undefined) row.summary = article.summary;
  if (article.whyReview !== undefined) row.why_review = article.whyReview;
  if (article.verdictText !== undefined) row.verdict_text = article.verdictText;
  if (article.takeaways !== undefined) row.takeaways = JSON.stringify(article.takeaways);
  if (article.body !== undefined) row.body = article.body;
  return row;
}

function rowToLink(row: Record<string, unknown>): Link {
  return {
    id: row.id as string,
    url: row.url as string,
    title: row.title as string,
    type: (row.type as LinkType) || 'article',
    backend: (row.backend as LinkBackend) || 'sqlite',
    category: (row.category as string) || '',
    tags: JSON.parse((row.tags as string) || '[]'),
    description: (row.description as string) || '',
    dateAdded: row.date_added as string,
    topicIds: [],
    externalId: row.external_id as string | undefined,
  };
}

function linkToRow(link: Partial<Link>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (link.id !== undefined) row.id = link.id;
  if (link.url !== undefined) row.url = link.url;
  if (link.title !== undefined) row.title = link.title;
  if (link.type !== undefined) row.type = link.type;
  if (link.backend !== undefined) row.backend = link.backend;
  if (link.category !== undefined) row.category = link.category;
  if (link.tags !== undefined) row.tags = JSON.stringify(link.tags);
  if (link.description !== undefined) row.description = link.description;
  if (link.dateAdded !== undefined) row.date_added = link.dateAdded;
  if (link.externalId !== undefined) row.external_id = link.externalId;
  return row;
}

function rowToTopic(row: Record<string, unknown>, linkCount: number): Topic {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) || '',
    tags: JSON.parse((row.tags as string) || '[]'),
    summary: (row.summary as string) || '',
    linkCount,
    dateCreated: row.date_created as string,
    dateUpdated: row.date_updated as string,
  };
}

export class SQLiteBackend implements StorageBackend {
  private db: InstanceType<typeof Database>;

  constructor(dbPath: string = './curaitor.db') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.createTables();
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        folder TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        url TEXT DEFAULT '',
        source TEXT DEFAULT '',
        category TEXT DEFAULT 'general',
        confidence TEXT DEFAULT '',
        verdict TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        date_saved TEXT DEFAULT '',
        date_triaged TEXT DEFAULT '',
        bookmark_id INTEGER,
        media_type TEXT,
        reviewed_ignored TEXT,
        review_decision TEXT,
        autonomy_level INTEGER,
        summary TEXT DEFAULT '',
        why_review TEXT DEFAULT '',
        verdict_text TEXT DEFAULT '',
        takeaways TEXT DEFAULT '[]',
        body TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_articles_folder ON articles(folder);
      CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);

      CREATE TABLE IF NOT EXISTS recycle (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        category TEXT DEFAULT 'Uncategorized',
        is_duplicate INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT '',
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS links (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        type TEXT DEFAULT 'article',
        backend TEXT DEFAULT 'sqlite',
        category TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        description TEXT DEFAULT '',
        date_added TEXT DEFAULT (datetime('now')),
        external_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_links_url ON links(url);
      CREATE INDEX IF NOT EXISTS idx_links_type ON links(type);
      CREATE INDEX IF NOT EXISTS idx_links_backend ON links(backend);

      CREATE TABLE IF NOT EXISTS topics (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        summary TEXT DEFAULT '',
        date_created TEXT DEFAULT (datetime('now')),
        date_updated TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS topic_links (
        topic_id TEXT NOT NULL,
        link_id TEXT NOT NULL,
        PRIMARY KEY (topic_id, link_id),
        FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
        FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
      );
    `);
  }

  // Articles

  listArticles(folder: FolderName): Article[] {
    const rows = this.db
      .prepare('SELECT * FROM articles WHERE folder = ? ORDER BY date_triaged DESC')
      .all(folder) as Record<string, unknown>[];
    return rows.map(rowToArticle);
  }

  getArticle(folder: FolderName, id: string): Article | null {
    const row = this.db
      .prepare('SELECT * FROM articles WHERE folder = ? AND id = ?')
      .get(folder, id) as Record<string, unknown> | undefined;
    return row ? rowToArticle(row) : null;
  }

  createArticle(folder: FolderName, article: Partial<Article>): Article {
    const id = crypto.randomUUID();
    const row = articleToRow({ ...article, id, folder });

    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map((c) => row[c]);

    this.db
      .prepare(`INSERT INTO articles (${columns.join(', ')}) VALUES (${placeholders})`)
      .run(...values);

    return this.getArticle(folder, id)!;
  }

  moveArticle(fromFolder: FolderName, toFolder: FolderName, id: string): void {
    this.db
      .prepare("UPDATE articles SET folder = ?, updated_at = datetime('now') WHERE id = ? AND folder = ?")
      .run(toFolder, id, fromFolder);
  }

  deleteArticle(folder: FolderName, id: string): void {
    this.db
      .prepare('DELETE FROM articles WHERE id = ? AND folder = ?')
      .run(id, folder);
  }

  updateArticle(folder: FolderName, id: string, updates: Partial<Article>): void {
    const row = articleToRow(updates);
    const keys = Object.keys(row);
    if (keys.length === 0) return;

    const setClauses = keys.map((k) => `${k} = ?`);
    setClauses.push("updated_at = datetime('now')");
    const values = keys.map((k) => row[k]);

    this.db
      .prepare(`UPDATE articles SET ${setClauses.join(', ')} WHERE id = ? AND folder = ?`)
      .run(...values, id, folder);
  }

  folderCount(folder: FolderName): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM articles WHERE folder = ?')
      .get(folder) as { count: number };
    return row.count;
  }

  allFolderCounts(): Record<FolderName, number> {
    const rows = this.db
      .prepare('SELECT folder, COUNT(*) as count FROM articles GROUP BY folder')
      .all() as { folder: FolderName; count: number }[];

    const counts: Record<FolderName, number> = {
      inbox: 0,
      review: 0,
      ignored: 0,
      archive: 0,
      library: 0,
      topics: 0,
    };
    for (const row of rows) {
      counts[row.folder] = row.count;
    }
    return counts;
  }

  // Recycle

  loadRecycle(): RecycleEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM recycle ORDER BY created_at DESC')
      .all() as Record<string, unknown>[];
    return rows.map((row) => ({
      title: row.title as string,
      url: row.url as string,
      category: row.category as string,
      isDuplicate: (row.is_duplicate as number) === 1,
    }));
  }

  appendRecycle(title: string, url: string, tag?: string): void {
    this.db
      .prepare('INSERT INTO recycle (title, url, category) VALUES (?, ?, ?)')
      .run(title, url, tag ?? 'Uncategorized');
  }

  clearRecycle(): void {
    this.db.prepare('DELETE FROM recycle').run();
  }

  recycleCount(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM recycle')
      .get() as { count: number };
    return row.count;
  }

  // Metrics

  loadStats(): AccuracyStats {
    const row = this.db
      .prepare("SELECT value FROM config WHERE key = 'accuracy_stats'")
      .get() as { value: string } | undefined;
    if (!row) return { ...DEFAULT_STATS };
    return JSON.parse(row.value) as AccuracyStats;
  }

  saveStats(stats: AccuracyStats): void {
    this.db
      .prepare("INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('accuracy_stats', ?, datetime('now'))")
      .run(JSON.stringify(stats));
  }

  // Links

  listLinks(opts?: { topicId?: string; type?: LinkType; category?: string; backend?: LinkBackend }): Link[] {
    let sql = 'SELECT l.* FROM links l';
    const params: unknown[] = [];
    const wheres: string[] = [];

    if (opts?.topicId) {
      sql += ' JOIN topic_links tl ON tl.link_id = l.id';
      wheres.push('tl.topic_id = ?');
      params.push(opts.topicId);
    }
    if (opts?.type) {
      wheres.push('l.type = ?');
      params.push(opts.type);
    }
    if (opts?.category) {
      wheres.push('l.category = ?');
      params.push(opts.category);
    }
    if (opts?.backend) {
      wheres.push('l.backend = ?');
      params.push(opts.backend);
    }
    if (wheres.length > 0) {
      sql += ' WHERE ' + wheres.join(' AND ');
    }
    sql += ' ORDER BY l.date_added DESC';

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map((row) => {
      const link = rowToLink(row);
      const topicRows = this.db
        .prepare('SELECT topic_id FROM topic_links WHERE link_id = ?')
        .all(link.id) as { topic_id: string }[];
      link.topicIds = topicRows.map((r) => r.topic_id);
      return link;
    });
  }

  getLink(id: string): Link | null {
    const row = this.db
      .prepare('SELECT * FROM links WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    const link = rowToLink(row);
    const topicRows = this.db
      .prepare('SELECT topic_id FROM topic_links WHERE link_id = ?')
      .all(id) as { topic_id: string }[];
    link.topicIds = topicRows.map((r) => r.topic_id);
    return link;
  }

  createLink(link: Partial<Link>): Link {
    const id = crypto.randomUUID();
    const row = linkToRow({ ...link, id });

    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map((c) => row[c]);

    this.db
      .prepare(`INSERT INTO links (${columns.join(', ')}) VALUES (${placeholders})`)
      .run(...values);

    if (link.topicIds) {
      const stmt = this.db.prepare('INSERT OR IGNORE INTO topic_links (topic_id, link_id) VALUES (?, ?)');
      for (const topicId of link.topicIds) {
        stmt.run(topicId, id);
      }
    }

    return this.getLink(id)!;
  }

  updateLink(id: string, updates: Partial<Link>): void {
    const row = linkToRow(updates);
    const keys = Object.keys(row);
    if (keys.length === 0) return;

    const setClauses = keys.map((k) => `${k} = ?`);
    const values = keys.map((k) => row[k]);

    this.db
      .prepare(`UPDATE links SET ${setClauses.join(', ')} WHERE id = ?`)
      .run(...values, id);
  }

  deleteLink(id: string): void {
    this.db.prepare('DELETE FROM topic_links WHERE link_id = ?').run(id);
    this.db.prepare('DELETE FROM links WHERE id = ?').run(id);
  }

  linkCount(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM links')
      .get() as { count: number };
    return row.count;
  }

  // Topics

  listTopics(): Topic[] {
    const rows = this.db
      .prepare(`
        SELECT t.*, COUNT(tl.link_id) as link_count
        FROM topics t
        LEFT JOIN topic_links tl ON tl.topic_id = t.id
        GROUP BY t.id
        ORDER BY t.date_updated DESC
      `)
      .all() as Record<string, unknown>[];
    return rows.map((row) => rowToTopic(row, (row.link_count as number) || 0));
  }

  getTopic(id: string): Topic | null {
    const row = this.db
      .prepare('SELECT * FROM topics WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    const countRow = this.db
      .prepare('SELECT COUNT(*) as count FROM topic_links WHERE topic_id = ?')
      .get(id) as { count: number };
    return rowToTopic(row, countRow.count);
  }

  createTopic(topic: Partial<Topic>): Topic {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(`
        INSERT INTO topics (id, name, description, tags, summary, date_created, date_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        topic.name ?? '',
        topic.description ?? '',
        JSON.stringify(topic.tags ?? []),
        topic.summary ?? '',
        now,
        now,
      );

    return this.getTopic(id)!;
  }

  updateTopic(id: string, updates: Partial<Topic>): void {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
    if (updates.description !== undefined) { sets.push('description = ?'); values.push(updates.description); }
    if (updates.tags !== undefined) { sets.push('tags = ?'); values.push(JSON.stringify(updates.tags)); }
    if (updates.summary !== undefined) { sets.push('summary = ?'); values.push(updates.summary); }

    if (sets.length === 0) return;

    sets.push("date_updated = datetime('now')");

    this.db
      .prepare(`UPDATE topics SET ${sets.join(', ')} WHERE id = ?`)
      .run(...values, id);
  }

  deleteTopic(id: string): void {
    this.db.prepare('DELETE FROM topics WHERE id = ?').run(id);
  }

  getTopicLinks(topicId: string): Link[] {
    const rows = this.db
      .prepare(`
        SELECT l.* FROM links l
        JOIN topic_links tl ON tl.link_id = l.id
        WHERE tl.topic_id = ?
        ORDER BY l.date_added DESC
      `)
      .all(topicId) as Record<string, unknown>[];
    return rows.map((row) => {
      const link = rowToLink(row);
      const topicRows = this.db
        .prepare('SELECT topic_id FROM topic_links WHERE link_id = ?')
        .all(link.id) as { topic_id: string }[];
      link.topicIds = topicRows.map((r) => r.topic_id);
      return link;
    });
  }

  addLinkToTopic(linkId: string, topicId: string): void {
    this.db
      .prepare('INSERT OR IGNORE INTO topic_links (topic_id, link_id) VALUES (?, ?)')
      .run(topicId, linkId);
  }

  removeLinkFromTopic(linkId: string, topicId: string): void {
    this.db
      .prepare('DELETE FROM topic_links WHERE topic_id = ? AND link_id = ?')
      .run(topicId, linkId);
  }

  // Config

  readConfig(key: ConfigKey): string {
    const row = this.db
      .prepare('SELECT value FROM config WHERE key = ?')
      .get(key) as { value: string } | undefined;
    return row?.value ?? '';
  }

  writeConfig(key: ConfigKey, content: string): void {
    this.db
      .prepare("INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, datetime('now'))")
      .run(key, content);
  }
}
