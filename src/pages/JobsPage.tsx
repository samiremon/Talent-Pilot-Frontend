/**
 * Jobs list, from GET /api/jobs.
 *
 * - The first column is the short Job ID (JOB-0007).
 * - The WHOLE row opens the job (click anywhere on it, or Tab to it and press Enter);
 *   hovering highlights it clearly.
 * - Each row has Edit and Delete buttons. Delete asks for confirmation first.
 *   (The AI can do both too, via a card you confirm in the chat.)
 */
import { Briefcase, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { LoadState } from '../components/DataParts';
import { useDeleteJob } from '../components/useDeleteJob';
import { EmptyState, PageHeader } from '../components/PageParts';
import { orUnknown, remoteLabel, timeAgo, tokenDetail, tokens } from '../format';
import type { Job } from '../types';
import { useApi } from '../useApi';

export function JobsPage() {
  const { data, error, loading } = useApi<{ jobs: Job[] }>('/jobs');
  const navigate = useNavigate();
  const deleteJob = useDeleteJob();

  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle="Every role you're hiring for."
        actions={
          <Link to="/jobs/new" className="button">
            <Plus size={16} aria-hidden="true" /> New job
          </Link>
        }
      />
      <LoadState loading={loading && !data} error={error} />

      {data && data.jobs.length === 0 && (
        <div className="card">
          <EmptyState icon={Briefcase} title="No jobs yet">
            Paste a job description into the chat and TalentPilot will extract the details for you to confirm, or{' '}
            <Link to="/jobs/new">create one yourself</Link>.
          </EmptyState>
        </div>
      )}

      {data && data.jobs.length > 0 && (
        // The wrapper scrolls sideways on narrow screens instead of squashing the table.
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Job ID</th>
                <th scope="col">Job</th>
                <th scope="col">Location</th>
                <th scope="col">Candidates</th>
                <th scope="col">Contacted</th>
                <th scope="col">Hired</th>
                <th scope="col">AI tokens</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.jobs.map((job) => (
                <tr
                  key={job.id}
                  className="row-link"
                  // Keyboard users can Tab to the row and press Enter, like a link.
                  tabIndex={0}
                  aria-label={`Open ${job.title}`}
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') navigate(`/jobs/${job.id}`);
                  }}
                >
                  <td className="job-code">{job.jobCode ?? '–'}</td>
                  <td>
                    <Link to={`/jobs/${job.id}`} className="table__title">
                      {job.title}
                    </Link>
                    {/* Seniority and age under the title keep the table narrow enough to fit
                        next to the chat. */}
                    <div className="muted small">
                      {orUnknown(job.seniority)} · {timeAgo(job.createdAt)}
                    </div>
                  </td>
                  <td>
                    {orUnknown(job.location)} · {remoteLabel(job.remotePolicy)}
                  </td>
                  <td>{job.totalCandidates}</td>
                  <td>{job.totalCandidates - job.counts.sourced - job.counts.accepted - job.counts.rejected}</td>
                  <td>{job.counts.hired}</td>
                  <td title={tokenDetail(job.aiUsage)}>{tokens(job.aiUsage.inputTokens + job.aiUsage.outputTokens)}</td>
                  <td className="row-actions">
                    {/* stopPropagation: these buttons must not also open the job. */}
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Edit ${job.title}`}
                      title="Edit job"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/jobs/${job.id}/edit`);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-button--danger"
                      aria-label={`Delete ${job.title}`}
                      title="Delete job"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteJob.ask(job);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {deleteJob.dialog}
    </>
  );
}
