/**
 * Pages that are just a header + message for now: Candidates, Outreach, and "not found".
 * Each shows its empty state until the backend provides data (next steps).
 */
import { Compass, Mail, Users } from 'lucide-react';
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

export function OutreachPage() {
  return (
    <>
      <PageHeader title="Outreach" subtitle="Email campaigns and their results." />
      <div className="card">
        <EmptyState icon={Mail} title="No campaigns yet">
          Ask TalentPilot to draft outreach for a job. Nothing is sent until you approve it.
        </EmptyState>
      </div>
    </>
  );
}

export function NotFoundPage() {
  return (
    <div className="card">
      <EmptyState icon={Compass} title="Page not found">
        This page doesn't exist. <Link to="/">Go to the dashboard</Link>.
      </EmptyState>
    </div>
  );
}
