/**
 * Small pages: just "not found" now. (Candidates became the Calendar page; the Outreach page
 * grew into its own file.)
 */
import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/PageParts';

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
