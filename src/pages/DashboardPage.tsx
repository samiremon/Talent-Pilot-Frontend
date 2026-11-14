/**
 * Dashboard: the overview of all hiring, from GET /api/stats/overview.
 *
 *   - headline numbers: active jobs, candidates, reply rate, interested rate, meetings, hires
 *   - the hiring FUNNEL (count per stage) for all jobs, or for one job picked in the menu
 *   - recent activity
 *   - a table with the same numbers PER JOB (funnel button shows that job's funnel above)
 *
 * About the numbers (worked out on the backend, in stats/dashboard.ts):
 *   The funnel is CUMULATIVE: it counts everyone who ever REACHED a stage. Someone who was
 *   interviewed and then rejected still counts for Contacted, Replied, ... Interviewed.
 *   Otherwise every rejection would make the reply rate drop.
 *     reply rate      = replied ÷ contacted
 *     interested rate = interested ÷ replied
 *     meetings        = candidates who reached Meeting booked
 *     hires           = candidates hired
 *   Where people are RIGHT NOW (incl. Rejected, Not interested, ...) is shown under the funnel.
 *
 * The chat assistant reads the very same numbers (its get_hiring_stats tool), so asking
 * "what's our reply rate?" in the chat gives the answer shown here.
 */
import { BarChart3, Briefcase, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ActivityList, Funnel, LoadState } from '../components/DataParts';
import { EmptyState, PageHeader } from '../components/PageParts';
import { percent, tokens, tokenDetail } from '../format';
import { EXIT_STATUSES } from '../pipeline';
import type { JobStatsRow, Overview } from '../types';
import { useApi } from '../useApi';

/** The menu value meaning "every job together". */
const ALL_JOBS = 'all';

export function DashboardPage() {
  const { user } = useAuth();
  const { data, error, loading } = useApi<Overview>('/stats/overview');
  // Which job the funnel shows ("all" = every job together).
  const [funnelJob, setFunnelJob] = useState<string>(ALL_JOBS);

  // If the chosen job disappears (deleted elsewhere), fall back to all jobs.
  useEffect(() => {
    if (data && funnelJob !== ALL_JOBS && !data.perJob.some((j) => j.id === funnelJob)) setFunnelJob(ALL_JOBS);
  }, [data, funnelJob]);

  // The numbers the funnel panel shows: one job's, or the totals.
  const selected = useMemo(() => {
    if (!data) return null;
    const job = data.perJob.find((j) => j.id === funnelJob);
    if (job) return { name: jobName(job), funnel: job.funnel, current: job.current, replyRate: job.replyRate, interestedRate: job.interestedRate };
    return { name: 'All jobs', funnel: data.funnel, current: data.counts, replyRate: data.replyRate, interestedRate: data.interestedRate };
  }, [data, funnelJob]);

  /** "Funnel" button in the table: show that job's funnel and bring the panel into view. */
  function showFunnelFor(jobId: string) {
    setFunnelJob(jobId);
    document.getElementById('funnel-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.name ?? 'there'}`}
        subtitle="Your hiring at a glance."
        actions={
          <Link to="/jobs/new" className="button">
            <Plus size={16} aria-hidden="true" /> New job
          </Link>
        }
      />
      <LoadState loading={loading && !data} error={error} />

      {data && selected && (
        <>
          <section className="kpis kpis--6" aria-label="Key numbers">
            <Kpi
              label="Active jobs"
              value={String(data.activeJobs)}
              note={`AI usage: ${tokens(data.aiTokens.inputTokens + data.aiTokens.outputTokens)} tokens`}
              title={tokenDetail(data.aiTokens)}
            />
            <Kpi label="Candidates" value={String(data.totalCandidates)} note="Across all jobs" />
            <Kpi
              label="Reply rate"
              value={percent(data.replyRate)}
              note={`${data.funnel.replied} of ${data.funnel.contacted} contacted`}
              title="Candidates who replied ÷ candidates we emailed"
            />
            <Kpi
              label="Interested rate"
              value={percent(data.interestedRate)}
              note={`${data.funnel.interested} of ${data.funnel.replied} who replied`}
              title="Candidates interested (or who booked a meeting) ÷ candidates who replied"
            />
            <Kpi label="Meetings" value={String(data.meetings)} note="Meetings booked" />
            <Kpi label="Hires" value={String(data.hires)} note="All jobs" />
          </section>

          <div className="grid-2">
            <section className="card panel" aria-labelledby="funnel-title">
              <div className="panel__head">
                <h2 className="panel__title" id="funnel-title">
                  Hiring funnel
                </h2>
                {data.perJob.length > 0 && (
                  <label className="panel__select">
                    <span className="sr-only">Show the funnel for</span>
                    <select value={funnelJob} onChange={(e) => setFunnelJob(e.target.value)}>
                      <option value={ALL_JOBS}>All jobs</option>
                      {data.perJob.map((job) => (
                        <option key={job.id} value={job.id}>
                          {jobName(job)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <p className="muted small funnel__intro">
                Candidates who reached each stage ({selected.name}). The % is the share of the stage above that got this far.
              </p>
              <Funnel counts={selected.funnel} showConversion />
              <p className="funnel__rates">
                Reply rate <strong>{percent(selected.replyRate)}</strong> · Interested rate{' '}
                <strong>{percent(selected.interestedRate)}</strong>
              </p>
              <p className="muted small funnel__exits">
                Right now:{' '}
                {EXIT_STATUSES.map((s) => `${selected.current[s.id]} ${s.label.toLowerCase()}`).join(' · ')}
              </p>
            </section>

            <section className="card panel" aria-labelledby="activity-title">
              <h2 className="panel__title" id="activity-title">
                Recent activity
              </h2>
              <ActivityList items={data.recentActivity} showJob />
            </section>
          </div>

          <section className="card panel" aria-labelledby="jobs-title">
            <h2 className="panel__title" id="jobs-title">
              Per job
            </h2>
            {data.perJob.length === 0 ? (
              <EmptyState icon={Briefcase} title="No jobs yet">
                Paste a job description into the chat on the right and TalentPilot will set it up for you, or{' '}
                <Link to="/jobs/new">create one yourself</Link>.
              </EmptyState>
            ) : (
              <JobStatsTable jobs={data.perJob} onShowFunnel={showFunnelFor} selectedId={funnelJob} />
            )}
          </section>
        </>
      )}
    </>
  );
}

/** "JOB-0003 · Backend Engineer" (or just the title for very old jobs without a number). */
function jobName(job: JobStatsRow): string {
  return job.jobCode ? `${job.jobCode} · ${job.title}` : job.title;
}

/** The per-job table: candidates, contacted, reply rate, interested rate, meetings, hires. */
function JobStatsTable({
  jobs,
  onShowFunnel,
  selectedId,
}: {
  jobs: JobStatsRow[];
  onShowFunnel: (jobId: string) => void;
  selectedId: string;
}) {
  return (
    <div className="table-wrap">
      <table className="table job-stats">
        <thead>
          <tr>
            <th scope="col">Job</th>
            <th scope="col" className="num">
              Candidates
            </th>
            <th scope="col" className="num">
              Contacted
            </th>
            <th scope="col" className="num" title="Replied ÷ contacted">
              Reply rate
            </th>
            <th scope="col" className="num" title="Interested ÷ replied">
              Interested rate
            </th>
            <th scope="col" className="num">
              Meetings
            </th>
            <th scope="col" className="num">
              Hires
            </th>
            <th scope="col">
              <span className="sr-only">Funnel</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className={job.id === selectedId ? 'job-stats__row--selected' : undefined}>
              <td>
                <Link to={`/jobs/${job.id}`} className="table__title">
                  {job.title}
                </Link>
                <div className="muted small">
                  {job.jobCode ?? 'No id'} · {job.status}
                </div>
              </td>
              <td className="num">{job.totalCandidates}</td>
              <td className="num">{job.funnel.contacted}</td>
              <td className="num strong">{percent(job.replyRate)}</td>
              <td className="num strong">{percent(job.interestedRate)}</td>
              <td className="num">{job.meetings}</td>
              <td className="num">{job.hires}</td>
              <td className="num">
                <button
                  type="button"
                  className="button button--ghost button--small"
                  onClick={() => onShowFunnel(job.id)}
                  aria-label={`Show the funnel for ${job.title}`}
                >
                  <BarChart3 size={14} aria-hidden="true" /> Funnel
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Kpi({ label, value, note, title }: { label: string; value: string; note: string; title?: string }) {
  return (
    <div className="card kpi" title={title}>
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">{value}</div>
      <div className="kpi__note">{note}</div>
    </div>
  );
}
