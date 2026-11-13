/**
 * Candidate details popup: everything we know about one candidate, opened by clicking
 * their row in the Candidates table (or their card on the Pipeline board).
 *
 * Shows:
 *   - name, title, location, email, profile link, where they came from (CSV / web search)
 *   - status in the pipeline and when they were added
 *   - the AI's score, its reason and the evidence quotes it used
 *   - the full text from the CSV, split into its parts (summary, skills, experience, ...)
 *
 * The CSV text is stored as labelled lines ("summary: ...", "skills: ...", see the
 * backend's sourcing/csv.ts); we turn each label into its own section here.
 * Missing details say "Unknown" (we never guess).
 *
 * Uses the browser's <dialog>: Esc closes, focus stays inside, the page behind is dimmed.
 */
import { ExternalLink, Mail, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { orUnknown, timeAgo } from '../format';
import type { Candidate } from '../types';
import { ScoreBadge, StatusChip } from './DataParts';

/** "summary: a\nskills: b" -> [{ label: 'Summary', text: 'a' }, { label: 'Skills', text: 'b' }] */
export function splitProfileText(text: string | null): { label: string; text: string }[] {
  if (!text?.trim()) return [];
  const sections: { label: string; text: string }[] = [];
  for (const line of text.split('\n')) {
    const match = /^([a-z][a-z ]{1,30}):\s*(.*)$/i.exec(line.trim());
    if (match) {
      const label = match[1]!.trim();
      sections.push({ label: label[0]!.toUpperCase() + label.slice(1), text: match[2]!.trim() });
    } else if (sections.length) {
      // A line without a label belongs to the section above it.
      sections[sections.length - 1]!.text += `\n${line}`;
    } else {
      sections.push({ label: 'Profile', text: line });
    }
  }
  return sections.filter((s) => s.text.trim());
}

const SOURCE_LABELS: Record<Candidate['source'], string> = { csv: 'CSV upload', web: 'Web search', manual: 'Added by hand' };

interface Props {
  candidate: Candidate | null;
  onClose: () => void;
}

export function CandidateDetailsDialog({ candidate, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (candidate && !dialog.open) dialog.showModal();
    if (!candidate && dialog.open) dialog.close();
  }, [candidate]);

  const sections = splitProfileText(candidate?.profileText ?? null);

  return (
    <dialog
      ref={ref}
      className="details-dialog"
      aria-labelledby="candidate-details-title"
      onClose={onClose}
      // Clicking the dimmed area outside the panel closes it.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      {candidate && (
        <div className="details-dialog__panel">
          <header className="details-dialog__header">
            <div className="candidate-head">
              <ScoreBadge score={candidate.score} />
              <div>
                <h2 id="candidate-details-title">{candidate.name}</h2>
                <p className="muted">{orUnknown(candidate.headline)}</p>
              </div>
            </div>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close candidate details">
              <X size={18} />
            </button>
          </header>

          <dl className="details-grid">
            <div className="details-grid__item">
              <dt>Status</dt>
              <dd>
                <StatusChip status={candidate.status} />
              </dd>
            </div>
            <div className="details-grid__item">
              <dt>Location</dt>
              <dd>{orUnknown(candidate.location)}</dd>
            </div>
            <div className="details-grid__item">
              <dt>Email</dt>
              <dd>
                {candidate.email ? (
                  <a href={`mailto:${candidate.email}`}>
                    <Mail size={12} aria-hidden="true" /> {candidate.email}
                  </a>
                ) : (
                  'Unknown'
                )}
              </dd>
            </div>
            <div className="details-grid__item">
              <dt>Profile</dt>
              <dd>
                {candidate.profileUrl ? (
                  <a href={candidate.profileUrl} target="_blank" rel="noreferrer noopener">
                    {candidate.profileUrl.replace(/^https?:\/\/(www\.)?/, '')} <ExternalLink size={12} aria-hidden="true" />
                  </a>
                ) : (
                  'Unknown'
                )}
              </dd>
            </div>
            <div className="details-grid__item">
              <dt>Source</dt>
              <dd>{SOURCE_LABELS[candidate.source]}</dd>
            </div>
            <div className="details-grid__item">
              <dt>Added</dt>
              <dd title={new Date(candidate.createdAt).toLocaleString()}>{timeAgo(candidate.createdAt)}</dd>
            </div>
          </dl>

          <section className="details-section">
            <h3>AI score</h3>
            {candidate.score === null && !candidate.scoreReason ? (
              <p className="muted">Not scored yet.</p>
            ) : (
              <>
                <p className="candidate-reason">
                  {candidate.score !== null && <strong>{candidate.score}/100 · </strong>}
                  {candidate.scoreReason}
                </p>
                {candidate.evidence.length > 0 && (
                  <div className="candidate-evidence">
                    <span className="muted small">Evidence from their profile:</span>
                    {candidate.evidence.map((quote) => (
                      <q key={quote} className="evidence">
                        {quote}
                      </q>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {sections.length === 0 ? (
            <section className="details-section">
              <h3>Profile</h3>
              <p className="muted">No description was provided for this candidate.</p>
            </section>
          ) : (
            sections.map((section) => (
              <section key={section.label} className="details-section">
                <h3>{section.label}</h3>
                <div className="details-description details-description--short">{section.text}</div>
              </section>
            ))
          )}
        </div>
      )}
    </dialog>
  );
}
