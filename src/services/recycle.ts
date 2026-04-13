import { readFileSync, writeFileSync, existsSync } from 'fs';
import { FOLDERS } from '../config.js';

export interface RecycleEntry {
  title: string;
  url: string;
  category: string;
  isDuplicate: boolean;
}

export function loadRecycle(): RecycleEntry[] {
  if (!existsSync(FOLDERS.recycle)) return [];
  const content = readFileSync(FOLDERS.recycle, 'utf-8');
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

export function appendRecycle(title: string, url: string, tag?: string): void {
  const suffix = tag ? ` (${tag})` : '';
  const line = `- [${title}](${url})${suffix}\n`;

  if (!existsSync(FOLDERS.recycle)) {
    writeFileSync(FOLDERS.recycle, `# Recycle\n\nConfirmed ignored articles — reviewed and not worth keeping.\n\n${line}`);
  } else {
    const content = readFileSync(FOLDERS.recycle, 'utf-8');
    writeFileSync(FOLDERS.recycle, content.trimEnd() + '\n' + line);
  }
}

export function clearRecycle(): void {
  writeFileSync(FOLDERS.recycle, '# Recycle\n\nConfirmed ignored articles — reviewed and not worth keeping.\n');
}

export function recycleCount(): number {
  return loadRecycle().length;
}
