import { execSync } from 'child_process';

export interface CronJob {
  id: string;
  label: string;
  schedule: string;     // cron expression (e.g., "0 */6 * * *")
  command: string;      // the claude command (e.g., "/cu:triage")
  enabled: boolean;
  workDir: string;
}

const CURAITOR_MARKER = '# curaitor';

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
  triage: '0 */6 * * *',    // every 6 hours
  discover: '0 6 * * *',    // daily at 6am
};

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

function buildCronLine(job: CronJob): string {
  const cmd = `cd ${job.workDir} && claude -p "${job.command}" --permission-mode bypassPermissions >> ~/curaitor-${job.id}.log 2>&1`;
  return `${job.schedule} ${cmd}`;
}

function parseCronLine(line: string): { schedule: string; commandSlug: string } | null {
  const m = line.match(/^([0-9*/, -]+)\s+(.+)$/);
  if (!m) return null;
  // Extract the 5-field cron schedule
  const parts = m[0].split(/\s+/);
  if (parts.length < 6) return null;
  const schedule = parts.slice(0, 5).join(' ');
  const rest = parts.slice(5).join(' ');
  // Identify which curaitor command
  const cmdMatch = rest.match(/\/cu:(\w+)/);
  const commandSlug = cmdMatch ? cmdMatch[1] : '';
  return { schedule, commandSlug };
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

  // Remove existing curaitor lines
  const otherLines = crontab
    .split('\n')
    .filter((l) => !l.includes('/cu:') && l !== CURAITOR_MARKER && l.trim() !== '');

  // Build new curaitor section
  const curaitorLines = [CURAITOR_MARKER];
  for (const job of jobs) {
    const line = buildCronLine(job);
    if (job.enabled) {
      curaitorLines.push(line);
    } else {
      curaitorLines.push(`# ${line}`);
    }
  }

  const newCrontab = [...otherLines, '', ...curaitorLines, ''].join('\n');
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
