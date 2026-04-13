import { getBackend } from '../storage/index.js';
import type { Article, FolderName } from '../storage/types.js';

export type { FolderName } from '../storage/types.js';

export function listArticles(folder: FolderName): Article[] {
  return getBackend().listArticles(folder);
}

export function getArticle(folder: FolderName, id: string): Article | null {
  return getBackend().getArticle(folder, id);
}

export function createArticle(folder: FolderName, article: Partial<Article>): Article {
  return getBackend().createArticle(folder, article);
}

export function moveArticle(fromFolder: FolderName, toFolder: FolderName, id: string): void {
  getBackend().moveArticle(fromFolder, toFolder, id);
}

export function deleteArticle(folder: FolderName, id: string): void {
  getBackend().deleteArticle(folder, id);
}

export function updateArticle(folder: FolderName, id: string, updates: Partial<Article>): void {
  getBackend().updateArticle(folder, id, updates);
}

export function folderCount(folder: FolderName): number {
  return getBackend().folderCount(folder);
}

export function allFolderCounts(): Record<FolderName, number> {
  return getBackend().allFolderCounts();
}
