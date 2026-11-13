/**
 * Candidate ranking by AI score: #1 = best, then 2, 3, 4, ... with NO shared ranks.
 * Same rules as the backend (so the table and the AI's "rank #5 of 31" always agree):
 *   - only scored candidates get a rank; unscored ones have none (shown as "–")
 *   - equal scores: whoever was added first ranks higher (the candidates list's order)
 */
import type { Candidate } from './types';

export function rankCandidates(candidates: Candidate[]): Map<string, number> {
  const scored = candidates
    .filter((c) => c.score !== null)
    .sort((a, b) => b.score! - a.score! || String(a.createdAt).localeCompare(String(b.createdAt)) || a.id.localeCompare(b.id));
  return new Map(scored.map((c, index) => [c.id, index + 1]));
}
