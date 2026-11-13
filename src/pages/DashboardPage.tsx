/**
 * Dashboard: the overview of all hiring.
 *   - 4 headline numbers (active jobs, candidates, reply rate, hires)
 *   - the pipeline funnel: how many candidates are at each status
 *   - recent activity
 *
 * There's no data yet (jobs and candidates come in the next steps), so every number is 0
 * and the lists show their empty message. When the backend is ready, only the numbers
 * change: this layout stays.
 */
import { Activity, Briefcase } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, PageHeader } from '../components/PageParts';
import { PIPELINE_STATUSES } from '../pipeline';

const KPIS = [
  { label: 'Active jobs', value: '0', note: 'Create one from the chat' },
  { label: 'Candidates', value: '0', note: 'Across all jobs' },
  { label: 'Reply rate', value: '–', note: 'Replies ÷ contacted' },
  { label: 'Hires', value: '0', note: 'All time' },
];

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <>
      <PageHeader title={`Welcome, ${user?.name ?? 'there'}`} subtitle="Your hiring at a glance." />

      <section className="kpis" aria-label="Key numbers">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="card kpi">
            <div className="kpi__label">{kpi.label}</div>
            <div className="kpi__value">{kpi.value}</div>
            <div className="kpi__note">{kpi.note}</div>
          </div>
        ))}
      </section>

      <div className="grid-2">
        <section className="card panel" aria-labelledby="funnel-title">
          <h2 className="panel__title" id="funnel-title">
            Pipeline funnel
          </h2>
          <div className="funnel">
            {PIPELINE_STATUSES.map((status) => (
              <div key={status.id} className="funnel__row">
                <span>{status.label}</span>
                <span className="funnel__track">
                  {/* Bar width will be (count ÷ largest count). 0 for now. */}
                  <span className="funnel__bar" style={{ width: '0%' }} />
                </span>
                <span className="funnel__count">0</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card panel" aria-labelledby="activity-title">
          <h2 className="panel__title" id="activity-title">
            Recent activity
          </h2>
          <EmptyState icon={Activity} title="Nothing yet">
            Every change (by you, the AI or the system) will be listed here.
          </EmptyState>
        </section>
      </div>

      <section className="card panel" aria-labelledby="jobs-title">
        <h2 className="panel__title" id="jobs-title">
          Jobs
        </h2>
        <EmptyState icon={Briefcase} title="No jobs yet">
          Paste a job description into the chat on the right and TalentPilot will set it up for you.
        </EmptyState>
      </section>
    </>
  );
}
