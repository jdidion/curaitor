import { readdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { VAULT_PATH, FOLDERS } from '../config.js';
import { parseArticle, type Article } from '../lib/frontmatter.js';
import matter from 'gray-matter';

export type FolderName = 'inbox' | 'review' | 'ignored' | 'archive' | 'library' | 'topics';

export function listArticles(folder: FolderName): Article[] {
  const dir = FOLDERS[folder];
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
    .map((f) => {
      const content = readFileSync(join(dir, f), 'utf-8');
      const relPath = relative(VAULT_PATH, join(dir, f));
      return parseArticle(content, f, relPath);
    })
    .sort((a, b) => (b.dateTriaged || '').localeCompare(a.dateTriaged || ''));
}

export function getArticle(folder: FolderName, filename: string): Article | null {
  const filepath = join(FOLDERS[folder], filename);
  if (!existsSync(filepath)) return null;
  const content = readFileSync(filepath, 'utf-8');
  return parseArticle(content, filename, relative(VAULT_PATH, filepath));
}

export function moveArticle(fromFolder: FolderName, toFolder: FolderName, filename: string): void {
  const src = join(FOLDERS[fromFolder], filename);
  const dest = join(FOLDERS[toFolder], filename);
  mkdirSync(FOLDERS[toFolder], { recursive: true });
  renameSync(src, dest);
}

export function deleteArticle(folder: FolderName, filename: string): void {
  const filepath = join(FOLDERS[folder], filename);
  if (existsSync(filepath)) unlinkSync(filepath);
}

export function updateFrontmatter(folder: FolderName, filename: string, updates: Record<string, unknown>): void {
  const filepath = join(FOLDERS[folder], filename);
  if (!existsSync(filepath)) return;

  const raw = readFileSync(filepath, 'utf-8');
  const { data: fm, content } = matter(raw);
  Object.assign(fm, updates);
  const updated = matter.stringify(content, fm);
  writeFileSync(filepath, updated);
}

export function folderCount(folder: FolderName): number {
  const dir = FOLDERS[folder];
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('.')).length;
}

export function allFolderCounts(): Record<FolderName, number> {
  return {
    inbox: folderCount('inbox'),
    review: folderCount('review'),
    ignored: folderCount('ignored'),
    archive: folderCount('archive'),
    library: folderCount('library'),
    topics: folderCount('topics'),
  };
}
