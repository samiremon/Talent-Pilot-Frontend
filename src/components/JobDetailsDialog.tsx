/**
 * "Job details" panel: every field of a job in one tidy place, opened from the job page.
 *
 * Shows the same fields as the New job form (title, company, description, skills,
 * seniority, location, work style, salary, original link) plus the token meter and
 * creation date. Missing values say "Unknown" (never guessed).
 *
 * Uses the browser's built-in <dialog> element: it traps keyboard focus inside while
 * open, closes with Esc, and dims the page behind it.
 */
import { ExternalLink, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { orUnknown, remoteLabel, tokenDetail } from '../format';
import type { Job } from '../types';

interface Props {
  job: Job;
  open: boolean;
  onClose: () => void;
}

export function JobDetailsDialog({ job, open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  // Open/close the native dialog when `open` changes.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="details-dialog"
      aria-labelledby="job-details-title"
      // Esc or the X button: tell the parent so its state stays in sync.
      onClose={onClose}
      // Clicking the dimmed area outside the panel closes it too.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="details-dialog__panel">
        <header className="details-dialog__header">
          <div>
            <h2 id="job-details-title">{job.title}</h2>
            {job.company && <p className="muted">{job.company}</p>}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close job details">
            <X size={18} />
          </button>
        </header>

        <dl className="details-grid">
          <Detail label="Seniority" value={orUnknown(job.seniority)} />
          <Detail label="Location" value={orUnknown(job.location)} />
          <Detail label="Work style" value={remoteLabel(job.remotePolicy)} />
          <Detail label="Salary" value={orUnknown(job.salary)} />
          <Detail label="Status" value={job.status[0]!.toUpperCase() + job.status.slice(1)} />
          <Detail label="Created" value={new Date(job.createdAt).toLocaleString()} />
          <Detail label="AI usage" value={tokenDetail(job.aiUsage)} />
          <Detail
            label="Original posting"
            value={
              job.sourceUrl ? (
                <a href={job.sourceUrl} target="_blank" rel="noreferrer noopener">
                  Open link <ExternalLink size={12} aria-hidden="true" />
                </a>
              ) : (
                'Unknown'
              )
            }
          />
        </dl>

        <section className="details-section">
          <h3>Must-have skills</h3>
          <SkillList skills={job.mustHaveSkills} must />
        </section>
        <section className="details-section">
          <h3>Nice-to-have skills</h3>
          <SkillList skills={job.niceToHaveSkills} />
        </section>
        <section className="details-section">
          <h3>Job description</h3>
          {/* pre-wrap keeps the line breaks and bullet points as they were pasted. */}
          <div className="details-description">{job.description ?? job.descriptionPreview}</div>
        </section>
      </div>
    </dialog>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="details-grid__item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function SkillList({ skills, must = false }: { skills: string[]; must?: boolean }) {
  if (skills.length === 0) return <p className="muted">{must ? 'Unknown' : 'None'}</p>;
  return (
    <div className="skills">
      {skills.map((skill) => (
        <span key={skill} className={must ? 'skill skill--must' : 'skill'}>
          {skill}
        </span>
      ))}
    </div>
  );
}
