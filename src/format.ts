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

/** 0.0412 -> "$0.04". Tiny but non-zero amounts show as "<$0.01" rather than "$0.00". */
export function money(usd: number): string {
  if (usd > 0 && usd < 0.01) return '<$0.01';
  return `$${usd.toFixed(2)}`;
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
