/**
 * Dashboard: the overview of all hiring, from GET /api/stats/overview.
 *   - 4 headline numbers (active jobs, candidates, reply rate, hires)
 *   - the pipeline funnel: how many candidates are at each status
 *   - recent activity, and the latest jobs
 */
import { Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ActivityList, Funnel, LoadState } from '../components/DataParts';
import { EmptyState, PageHeader } from '../components/PageParts';
import { money, percent } from '../format';
import type { Overview } from '../types';
import { useApi } from '../useApi';

export function DashboardPage() {
  const { user } = useAuth();
  const { data, error, loading } = useApi<Overview>('/stats/overview');

  return (
    <>
      <PageHeader title={`Welcome, ${user?.name ?? 'there'}`} subtitle="Your hiring at a glance." />
      <LoadState loading={loading && !data} error={error} />

      {data && (
        <>
          <section className="kpis" aria-label="Key numbers">
            <Kpi label="Active jobs" value={String(data.activeJobs)} note={`AI cost so far: ${money(data.aiCostUsd)}`} />
            <Kpi label="Candidates" value={String(data.totalCandidates)} note="Across all jobs" />
            <Kpi label="Reply rate" value={percent(data.replyRate)} note="Replied ÷ contacted" />
            <Kpi label="Hires" value={String(data.hires)} note="All jobs" />
          </section>

          <div className="grid-2">
            <section className="card panel" aria-labelledby="funnel-title">
              <h2 className="panel__title" id="funnel-title">
                Pipeline funnel
              </h2>
              <Funnel counts={data.counts} />
            </section>

            <section className="card panel" aria-labelledby="activity-title">
              <h2 className="panel__title" id="activity-title">
                Recent activity
              </h2>
              <ActivityList items={data.recentActivity} />
            </section>
          </div>

          <section className="card panel" aria-labelledby="jobs-title">
            <h2 className="panel__title" id="jobs-title">
              Latest jobs
            </h2>
            {data.jobs.length === 0 ? (
              <EmptyState icon={Briefcase} title="No jobs yet">
                Paste a job description into the chat on the right and TalentPilot will set it up for you.
              </EmptyState>
            ) : (
              <ul className="link-list">
                {data.jobs.map((job) => (
                  <li key={job.id}>
                    <Link to={`/jobs/${job.id}`}>{job.title}</Link>
                    <span className="muted">
                      {job.totalCandidates} candidates · {job.hired} hired
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card kpi">
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">{value}</div>
      <div className="kpi__note">{note}</div>
    </div>
  );
}
