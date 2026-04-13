import type { StorageBackend } from './types.js';
import { ObsidianBackend } from './obsidian.js';
import { SQLiteBackend } from './sqlite.js';
import { VAULT_PATH, PLUGIN_PATH } from '../config.js';

let _backend: StorageBackend | null = null;

export function initBackend(): StorageBackend {
  const type = process.env.STORAGE_BACKEND || 'obsidian';

  if (type === 'sqlite') {
    const dbPath = process.env.SQLITE_PATH || './curaitor.db';
    _backend = new SQLiteBackend(dbPath);
    console.log(`Storage: SQLite (${dbPath})`);
  } else {
    _backend = new ObsidianBackend(VAULT_PATH, PLUGIN_PATH);
    console.log(`Storage: Obsidian (${VAULT_PATH})`);
  }

  return _backend;
}

export function getBackend(): StorageBackend {
  if (!_backend) throw new Error('Storage backend not initialized. Call initBackend() first.');
  return _backend;
}

export type { StorageBackend } from './types.js';
export type { Article, FolderName, RecycleEntry, AccuracyStats, ConfigKey, RollingEntry, SourceStats } from './types.js';
