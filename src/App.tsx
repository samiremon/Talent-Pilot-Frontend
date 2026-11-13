/**
 * Top of the app.
 *   1. While we ask the backend who's logged in -> "Loading…"
 *   2. Not logged in -> the login page (whatever address you opened)
 *   3. Logged in -> the app frame (AppShell) with the page for the current address
 *
 * Addresses (routes):
 *   /                      Dashboard
 *   /jobs                  Jobs list
 *   /jobs/:jobId[/tab]     One job, with tabs (see pages/JobPage.tsx)
 *   /candidates            All candidates
 *   /outreach              Email campaigns
 *   anything else          "Page not found"
 */
import { Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppShell } from './layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import {
  JobActivityTab,
  JobCandidatesTab,
  JobEmailsTab,
  JobPage,
  JobPipelineTab,
  JobRepliesTab,
} from './pages/JobPage';
import { LoginPage } from './pages/LoginPage';
import { CandidatesPage, JobsPage, NotFoundPage, OutreachPage } from './pages/SimplePages';

export function App() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <main className="auth-page">
        <p className="muted" role="status">
          Loading…
        </p>
      </main>
    );
  }

  if (status === 'signed-out') return <LoginPage />;

  return (
    <Routes>
      {/* Every page below is shown inside the app frame (top bar, sidebar, chat). */}
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="jobs/:jobId" element={<JobPage />}>
          <Route index element={<JobCandidatesTab />} />
          <Route path="pipeline" element={<JobPipelineTab />} />
          <Route path="replies" element={<JobRepliesTab />} />
          <Route path="emails" element={<JobEmailsTab />} />
          <Route path="activity" element={<JobActivityTab />} />
        </Route>
        <Route path="candidates" element={<CandidatesPage />} />
        <Route path="outreach" element={<OutreachPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
