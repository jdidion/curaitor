import { config } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

config();

function findVault(): string {
  // From env
  if (process.env.VAULT_PATH && existsSync(process.env.VAULT_PATH)) {
    return process.env.VAULT_PATH;
  }

  // From Obsidian config
  const obsidianConfig = join(
    process.env.HOME || '',
    'Library/Application Support/obsidian/obsidian.json'
  );
  if (existsSync(obsidianConfig)) {
    const cfg = JSON.parse(readFileSync(obsidianConfig, 'utf-8'));
    const vaults = Object.values(cfg.vaults || {}) as Array<{ path: string }>;
    const markers = ['Curaitor/Inbox', 'Curaitor/Review', 'Curaitor/Ignored'];

    let best = '';
    let bestScore = 0;
    for (const v of vaults) {
      if (!existsSync(v.path)) continue;
      const score = markers.filter((m) => existsSync(join(v.path, m))).length;
      if (score > bestScore) {
        best = v.path;
        bestScore = score;
      }
    }
    if (best) return best;
  }

  throw new Error('Could not find Obsidian vault. Set VAULT_PATH in .env');
}

function findPluginDir(): string {
  if (process.env.PLUGIN_PATH && existsSync(process.env.PLUGIN_PATH)) {
    return process.env.PLUGIN_PATH;
  }
  const candidates = [
    join(process.env.HOME || '', 'projects/claude-plugins/plugins/curaitor'),
    join(process.env.HOME || '', '.claude/plugins/curaitor'),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, 'config'))) return c;
  }
  throw new Error('Could not find curaitor plugin. Set PLUGIN_PATH in .env');
}

export const VAULT_PATH = findVault();
export const PLUGIN_PATH = findPluginDir();
export const PORT = parseInt(process.env.PORT || '3141', 10);

export const FOLDERS = {
  inbox: join(VAULT_PATH, 'Curaitor/Inbox'),
  review: join(VAULT_PATH, 'Curaitor/Review'),
  ignored: join(VAULT_PATH, 'Curaitor/Ignored'),
  archive: join(VAULT_PATH, 'Curaitor/Archive'),
  library: join(VAULT_PATH, 'Library'),
  topics: join(VAULT_PATH, 'Topics'),
  recycle: join(VAULT_PATH, 'Curaitor/Recycle.md'),
};

export const CONFIG = {
  accuracyStats: join(PLUGIN_PATH, 'config/accuracy-stats.yaml'),
  triageRules: join(PLUGIN_PATH, 'config/triage-rules.yaml'),
  feeds: join(PLUGIN_PATH, 'config/feeds.yaml'),
  readingPrefs: join(PLUGIN_PATH, 'config/reading-prefs.md'),
};
