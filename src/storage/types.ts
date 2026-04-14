export type FolderName = 'inbox' | 'review' | 'ignored' | 'archive' | 'library' | 'topics';
export type ConfigKey = 'feeds' | 'prefs' | 'rules' | 'accuracyStats';
export interface Article {
  id: string;                  // filename (obsidian) or UUID (sqlite)
  filename: string;            // same as id — kept for route/component compatibility
  folder: FolderName;
  title: string;
  url: string;
  source: string;
  category: string;
  confidence: string;
  verdict: string;
  tags: string[];
  dateSaved: string;
  dateTriaged: string;
  bookmarkId?: number;
  mediaType?: string;
  reviewedIgnored?: string;
  reviewDecision?: string;
  autonomyLevel?: number;
  slopScore?: number;          // 0-1 from slop detector
  slopLabel?: string;          // clean|mild|slop|heavy-slop
  summary: string;
  whyReview: string;
  verdictText: string;
  takeaways: string[];
  body: string;
}

export interface RecycleEntry {
  title: string;
  url: string;
  category: string;
  isDuplicate: boolean;
}

export interface SourceStats {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export interface RollingEntry {
  date: string;
  source: string;
  signal: string;
  title: string;
}

export interface AccuracyStats {
  autonomy_level: number;
  max_fp_rate: number;           // max false positive rate before demotion (default 0.05)
  max_fn_rate: number;           // max false negative rate before demotion (default 0.05)
  lifetime: {
    instapaper: SourceStats;
    rss: SourceStats;
  };
  rolling_window: RollingEntry[];
  review_ignored_passes: number;
  last_review_ignored: string | null;
}

export type LinkType = 'article' | 'paper' | 'repo' | 'tool' | 'video' | 'podcast' | 'other';
export type LinkBackend = 'obsidian' | 'sqlite' | 'zotero' | 'github-stars' | 'raindrop';

export interface Link {
  id: string;
  url: string;
  title: string;
  type: LinkType;
  backend: LinkBackend;
  category: string;            // hierarchical: "Genomics/Variant Calling"
  tags: string[];
  description: string;
  dateAdded: string;
  topicIds: string[];
  externalId?: string;         // Zotero item key, GitHub owner/repo, Raindrop ID
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  tags: string[];
  summary: string;
  linkCount: number;
  dateCreated: string;
  dateUpdated: string;
}

export interface StorageBackend {
  // Articles
  listArticles(folder: FolderName): Article[];
  getArticle(folder: FolderName, id: string): Article | null;
  createArticle(folder: FolderName, article: Partial<Article>): Article;
  moveArticle(fromFolder: FolderName, toFolder: FolderName, id: string): void;
  deleteArticle(folder: FolderName, id: string): void;
  updateArticle(folder: FolderName, id: string, updates: Partial<Article>): void;
  folderCount(folder: FolderName): number;
  allFolderCounts(): Record<FolderName, number>;

  // Recycle
  loadRecycle(): RecycleEntry[];
  appendRecycle(title: string, url: string, tag?: string): void;
  clearRecycle(): void;
  recycleCount(): number;

  // Metrics
  loadStats(): AccuracyStats;
  saveStats(stats: AccuracyStats): void;

  // Links
  listLinks(opts?: { topicId?: string; type?: LinkType; category?: string; backend?: LinkBackend }): Link[];
  getLink(id: string): Link | null;
  createLink(link: Partial<Link>): Link;
  updateLink(id: string, updates: Partial<Link>): void;
  deleteLink(id: string): void;
  linkCount(): number;

  // Topics
  listTopics(): Topic[];
  getTopic(id: string): Topic | null;
  createTopic(topic: Partial<Topic>): Topic;
  updateTopic(id: string, updates: Partial<Topic>): void;
  deleteTopic(id: string): void;
  getTopicLinks(topicId: string): Link[];
  addLinkToTopic(linkId: string, topicId: string): void;
  removeLinkFromTopic(linkId: string, topicId: string): void;

  // Config
  readConfig(key: ConfigKey): string;
  writeConfig(key: ConfigKey, content: string): void;
}
