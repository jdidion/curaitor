import { execSync } from 'child_process';

export interface CronJob {
  id: string;
  label: string;
  schedule: string;
  command: string;
  enabled: boolean;
  workDir: string;
}

export interface CronHealth {
  claudePath: string | null;
  cronShell: string;
  cronPath: string;
}

const CURAITOR_MARKER = '# curaitor managed jobs';

const DEFAULTS: Omit<CronJob, 'enabled' | 'schedule'>[] = [
  {
    id: 'triage',
    label: 'Triage Instapaper',
    command: '/cu:triage',
    workDir: process.env.CRON_WORK_DIR || process.cwd(),
  },
  {
    id: 'discover',
    label: 'Discover RSS feeds',
    command: '/cu:discover',
    workDir: process.env.CRON_WORK_DIR || process.cwd(),
  },
];

const DEFAULT_SCHEDULES: Record<string, string> = {
  triage: '0 */6 * * *',
  discover: '0 6 * * *',
};

/** Resolve the absolute path to `claude` */
function findClaude(): string | null {
  try {
    return execSync('which claude 2>/dev/null', { encoding: 'utf-8' }).trim() || null;
  } catch {
    return null;
  }
}

/** Build a PATH that includes common tool locations */
function buildCronPath(): string {
  const dirs = new Set<string>();

  // Include claude's directory
  const claude = findClaude();
  if (claude) {
    const dir = claude.replace(/\/[^/]+$/, '');
    dirs.add(dir);
  }

  // Common tool directories
  const candidates = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    `${process.env.HOME}/.local/bin`,
  ];
  for (const d of candidates) dirs.add(d);

  return [...dirs].join(':');
}

function readCrontab(): string {
  try {
    return execSync('crontab -l 2>/dev/null', { encoding: 'utf-8' });
  } catch {
    return '';
  }
}

function writeCrontab(content: string): void {
  execSync(`echo ${JSON.stringify(content)} | crontab -`, { encoding: 'utf-8' });
}

function buildCronLine(job: CronJob, claudePath: string): string {
  // Use absolute claude path, log with tail to prevent unbounded growth
  const cmd = [
    `cd ${job.workDir}`,
    `${claudePath} -p "${job.command}" --permission-mode bypassPermissions`,
    `2>&1 | tail -200 >> ~/curaitor-${job.id}.log`,
  ].join(' && ');
  return `${job.schedule} ${cmd}`;
}

function parseCronLine(line: string): { schedule: string; commandSlug: string } | null {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 6) return null;
  const schedule = parts.slice(0, 5).join(' ');
  const rest = parts.slice(5).join(' ');
  const cmdMatch = rest.match(/\/cu:(\w+)/);
  return cmdMatch ? { schedule, commandSlug: cmdMatch[1] } : null;
}

export function getCronHealth(): CronHealth {
  const claudePath = findClaude();
  return {
    claudePath,
    cronShell: '/bin/zsh',
    cronPath: buildCronPath(),
  };
}

export function loadCronJobs(): CronJob[] {
  const crontab = readCrontab();
  const lines = crontab.split('\n');

  return DEFAULTS.map((def) => {
    const activeLine = lines.find((l) => l.includes(`/cu:${def.id}`) && !l.startsWith('#'));
    const disabledLine = lines.find((l) => l.includes(`/cu:${def.id}`) && l.startsWith('#') && !l.startsWith('# curaitor'));
    const rawLine = activeLine ?? disabledLine?.replace(/^#\s*/, '');
    const parsed = rawLine ? parseCronLine(rawLine) : null;

    return {
      ...def,
      schedule: parsed?.schedule || DEFAULT_SCHEDULES[def.id],
      enabled: !!activeLine,
    };
  });
}

export function saveCronJobs(jobs: CronJob[]): void {
  const crontab = readCrontab();
  const health = getCronHealth();
  const claudePath = health.claudePath || 'claude';

  // Remove existing curaitor section (marker through next blank line or EOF)
  const lines = crontab.split('\n');
  const otherLines: string[] = [];
  let inCuraitorSection = false;
  for (const line of lines) {
    if (line.startsWith(CURAITOR_MARKER)) {
      inCuraitorSection = true;
      continue;
    }
    if (inCuraitorSection && line.trim() === '') {
      inCuraitorSection = false;
      continue;
    }
    if (!inCuraitorSection && !line.includes('/cu:')) {
      otherLines.push(line);
    }
  }

  // Also remove any stale curaitor env vars we previously set
  const cleanedLines = otherLines.filter(
    (l) => !l.match(/^(SHELL|PATH|HOME)=.*# curaitor/)
  );

  // Build new curaitor section with proper environment
  const curaitorLines = [
    CURAITOR_MARKER,
    `SHELL=/bin/zsh # curaitor`,
    `PATH=${health.cronPath} # curaitor`,
    `HOME=${process.env.HOME || ''} # curaitor`,
  ];

  for (const job of jobs) {
    const line = buildCronLine(job, claudePath);
    curaitorLines.push(job.enabled ? line : `# ${line}`);
  }

  const newCrontab = [...cleanedLines.filter((l) => l.trim()), '', ...curaitorLines, ''].join('\n');
  writeCrontab(newCrontab);
}

export function updateCronJob(id: string, updates: { schedule?: string; enabled?: boolean }): void {
  const jobs = loadCronJobs();
  const job = jobs.find((j) => j.id === id);
  if (!job) return;
  if (updates.schedule !== undefined) job.schedule = updates.schedule;
  if (updates.enabled !== undefined) job.enabled = updates.enabled;
  saveCronJobs(jobs);
}

/** Smoke test: verify claude is findable from cron-like environment */
export function verifyCronEnvironment(): { ok: boolean; error?: string } {
  const claude = findClaude();
  if (!claude) {
    return { ok: false, error: 'claude not found in PATH. Install Claude Code or set the path manually.' };
  }
  try {
    execSync(`${claude} --version 2>/dev/null`, { encoding: 'utf-8', timeout: 5000 });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `claude found at ${claude} but --version failed: ${(err as Error).message}` };
  }
}
