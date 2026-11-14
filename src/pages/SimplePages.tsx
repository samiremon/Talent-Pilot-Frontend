/**
 * Pages that are just a header + message for now: Candidates, Outreach, and "not found".
 * Each shows its empty state until the backend provides data (next steps).
 */
import { Compass, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState, PageHeader } from '../components/PageParts';

export function CandidatesPage() {
  return (
    <>
      <PageHeader title="Candidates" subtitle="Everyone found or uploaded, across all jobs." />
      <div className="card">
        <EmptyState icon={Users} title="No candidates yet">
          Candidates appear here after TalentPilot searches for them or you upload a CSV.
        </EmptyState>
      </div>
    </>
  );
}

// The Outreach page grew into its own file (job list + Emails / Replies tabs).
export { OutreachPage } from './OutreachPage';

export function NotFoundPage() {
  return (
    <div className="card">
      <EmptyState icon={Compass} title="Page not found">
        This page doesn't exist. <Link to="/">Go to the dashboard</Link>.
      </EmptyState>
    </div>
  );
}
