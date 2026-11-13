/**
 * Jobs list, from GET /api/jobs. Each row links to the job's page.
 */
import { Briefcase, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LoadState } from '../components/DataParts';
import { EmptyState, PageHeader } from '../components/PageParts';
import { orUnknown, remoteLabel, timeAgo, tokenDetail, tokens } from '../format';
import type { Job } from '../types';
import { useApi } from '../useApi';

export function JobsPage() {
  const { data, error, loading } = useApi<{ jobs: Job[] }>('/jobs');

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
                <th scope="col">Job</th>
                <th scope="col">Location</th>
                <th scope="col">Candidates</th>
                <th scope="col">Contacted</th>
                <th scope="col">Hired</th>
                <th scope="col">AI tokens</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <Link to={`/jobs/${job.id}`} className="table__title">
                      {job.title}
                    </Link>
                    <div className="muted small">{orUnknown(job.seniority)}</div>
                  </td>
                  <td>
                    {orUnknown(job.location)} · {remoteLabel(job.remotePolicy)}
                  </td>
                  <td>{job.totalCandidates}</td>
                  <td>{job.totalCandidates - job.counts.sourced - job.counts.accepted - job.counts.rejected}</td>
                  <td>{job.counts.hired}</td>
                  <td title={tokenDetail(job.aiUsage)}>{tokens(job.aiUsage.inputTokens + job.aiUsage.outputTokens)}</td>
                  <td className="muted">{timeAgo(job.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
