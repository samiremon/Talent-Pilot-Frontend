/**
 * Small helpers that turn raw values into text for the screen.
 * Missing values always become "Unknown" (we never guess).
 */

export const UNKNOWN = 'Unknown';

export function orUnknown(value: string | null | undefined): string {
  return value && value.trim() ? value : UNKNOWN;
}

/** 0.3412 -> "34%"; null (nothing to measure yet) -> "–". */
export function percent(value: number | null): string {
  return value === null ? '–' : `${Math.round(value * 100)}%`;
}

/** Token counts, short: 950 -> "950", 1540 -> "1.5k", 2_300_000 -> "2.3M". */
export function tokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** "1.5k tokens (1.2k in · 300 out)": used in tooltips for the token meter. */
export function tokenDetail(usage: { inputTokens: number; outputTokens: number }): string {
  const total = usage.inputTokens + usage.outputTokens;
  return `${tokens(total)} tokens (${tokens(usage.inputTokens)} in · ${tokens(usage.outputTokens)} out)`;
}

const REMOTE_LABELS = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site', unknown: UNKNOWN } as const;
export function remoteLabel(policy: keyof typeof REMOTE_LABELS): string {
  return REMOTE_LABELS[policy];
}

/** "2026-11-13T10:00:00Z" -> "5 min ago" / "3 h ago" / "2 days ago" / a date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Which site a profile link is on, for the "Profile" column: LinkedIn, GitHub,
 * Stack Overflow, Kaggle, or the website's own name (e.g. "janedoe.dev").
 */
export function profileSite(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (host.endsWith('linkedin.com')) return 'LinkedIn';
    if (host === 'github.com') return 'GitHub';
    if (host.endsWith('stackoverflow.com')) return 'Stack Overflow';
    if (host === 'kaggle.com') return 'Kaggle';
    if (host === 'example.com') return 'Sample profile';
    return host;
  } catch {
    return 'Profile';
  }
}
