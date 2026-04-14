import { config } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

config();

const HOME = process.env.HOME || process.env.USERPROFILE || '';

/** Cross-platform Obsidian config paths */
function obsidianConfigPaths(): string[] {
  const paths = [];
  if (process.env.OBSIDIAN_CONFIG) {
    paths.push(process.env.OBSIDIAN_CONFIG);
  }
  // macOS
  paths.push(join(HOME, 'Library/Application Support/obsidian/obsidian.json'));
  // Linux
  paths.push(join(HOME, '.config/obsidian/obsidian.json'));
  // Windows (via APPDATA)
  if (process.env.APPDATA) {
    paths.push(join(process.env.APPDATA, 'obsidian/obsidian.json'));
  }
  return paths;
}

function findVault(): string {
  if (process.env.VAULT_PATH && existsSync(process.env.VAULT_PATH)) {
    return process.env.VAULT_PATH;
  }

  // Try each platform's Obsidian config location
  for (const configPath of obsidianConfigPaths()) {
    if (!existsSync(configPath)) continue;
    let cfg: Record<string, unknown>;
    try {
      cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      continue;
    }
    const vaults = Object.values((cfg.vaults || {}) as Record<string, { path: string }>);
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

  // Check common plugin cache locations
  const candidates = [
    join(HOME, '.claude/plugins/cache/jdidion-plugins/curaitor'),
    join(HOME, '.claude/plugins/curaitor'),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, 'config'))) return c;
  }

  throw new Error('Could not find CurAItor plugin directory. Set PLUGIN_PATH in .env');
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
