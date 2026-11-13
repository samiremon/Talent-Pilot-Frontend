/**
 * One job's page, with tabs. Each tab has its own address so a refresh (or a shared link)
 * opens the same tab:
 *
 *   /jobs/:jobId              Candidates  (table: score, reason, evidence, accept/reject)
 *   /jobs/:jobId/pipeline     Pipeline    (kanban board, one column per status: from idea 4)
 *   /jobs/:jobId/replies      Replies     (inbox: reply list + AI draft answer: from idea 6)
 *   /jobs/:jobId/emails       Emails      (the outreach sequence)
 *   /jobs/:jobId/activity     Activity    (every change, with Undo)
 *
 * Jobs don't exist in the database yet, so for now every tab shows its empty layout.
 */
import { History, Inbox, Mail, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { EmptyState, PageHeader } from '../components/PageParts';
import { EXIT_STATUSES, PIPELINE_STATUSES } from '../pipeline';

const TABS = [
  { to: '', label: 'Candidates' },
  { to: 'pipeline', label: 'Pipeline' },
  { to: 'replies', label: 'Replies' },
  { to: 'emails', label: 'Emails' },
  { to: 'activity', label: 'Activity' },
];

export function JobPage() {
  return (
    <>
      <PageHeader title="Job" subtitle="Details appear here once the job is created from the chat." />

      <nav className="tabs" aria-label="Job sections">
        {TABS.map((tab) => (
          // `end` on the first tab: otherwise "Candidates" would stay active on every tab.
          <NavLink key={tab.label} to={tab.to} end={tab.to === ''} className="tab">
            {tab.label}
          </NavLink>
        ))}
      </nav>

      {/* The selected tab's component is shown here. */}
      <Outlet />
    </>
  );
}

export function JobCandidatesTab() {
  return (
    <div className="card">
      <EmptyState icon={Users} title="No candidates for this job yet">
        Ask TalentPilot to start searching, or upload a CSV. Each candidate gets a 0–100 score with the reason and
        the evidence behind it.
      </EmptyState>
    </div>
  );
}

/** Kanban board: one column per status. Columns are real; cards arrive with the data. */
export function JobPipelineTab() {
  const columns = [...PIPELINE_STATUSES, ...EXIT_STATUSES];
  return (
    <div className="board" role="list" aria-label="Pipeline board">
      {columns.map((status) => (
        <section key={status.id} className="board__column" role="listitem" aria-label={status.label}>
          <div className="board__heading">
            <span>{status.label}</span>
            <span className="board__count">0</span>
          </div>
          <div className="board__empty">No candidates</div>
        </section>
      ))}
    </div>
  );
}

/** Inbox: replies list on the left, the selected conversation + AI draft on the right. */
export function JobRepliesTab() {
  return (
    <div className="card inbox">
      <div className="inbox__list">
        <div className="inbox__list-header">Replies</div>
        <EmptyState icon={Inbox} title="No replies yet">
          Candidate replies will be listed here, labelled by the AI.
        </EmptyState>
      </div>
      <EmptyState icon={Mail} title="Select a reply">
        You'll see the conversation and the AI's drafted answer, ready to approve, edit or discard.
      </EmptyState>
    </div>
  );
}

export function JobEmailsTab() {
  return (
    <div className="card">
      <EmptyState icon={Mail} title="No outreach yet">
        TalentPilot will draft a personalised email or a sequence (e.g. Day 0, 3 and 7) for accepted candidates. You
        preview and approve before anything is sent.
      </EmptyState>
    </div>
  );
}

export function JobActivityTab() {
  return (
    <div className="card">
      <EmptyState icon={History} title="No activity yet">
        Every change to this job is recorded here: who did it (you, the AI or the system), when, and an Undo button.
      </EmptyState>
    </div>
  );
}
