export type FolderName = 'inbox' | 'review' | 'ignored' | 'archive' | 'library' | 'topics';
export type ConfigKey = 'feeds' | 'prefs' | 'rules' | 'accuracyStats';
export type SignalType = 'tp' | 'fp' | 'tn' | 'fn';

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
  lifetime: {
    instapaper: SourceStats;
    rss: SourceStats;
  };
  rolling_window: RollingEntry[];
  review_ignored_passes: number;
  last_review_ignored: string | null;
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

  // Config
  readConfig(key: ConfigKey): string;
  writeConfig(key: ConfigKey, content: string): void;
}
