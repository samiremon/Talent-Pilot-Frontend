/**
 * Candidate ranking by AI score, #1 = best. Same rules as the backend (so the table and
 * the AI's "rank #5 of 31" message always agree):
 *   - only scored candidates get a rank; unscored ones have none (shown as "–")
 *   - equal scores share a rank, and the next one skips: 90, 80, 80, 70 -> #1, #2, #2, #4
 */
import type { Candidate } from './types';

export function rankCandidates(candidates: Candidate[]): Map<string, number> {
  const scored = candidates.filter((c) => c.score !== null).sort((a, b) => b.score! - a.score!);
  const ranks = new Map<string, number>();
  scored.forEach((c, index) => {
    const previous = scored[index - 1];
    ranks.set(c.id, previous && previous.score === c.score ? ranks.get(previous.id)! : index + 1);
  });
  return ranks;
}
