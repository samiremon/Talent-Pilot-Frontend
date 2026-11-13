/**
 * Top of the app.
 *   1. While we ask the backend who's logged in -> "Loading…"
 *   2. Not logged in -> the signed-out pages:
 *        /login  /signup  /verify-email?email=...  /forgot-password  /reset-password?token=...
 *      (any other address goes to /login)
 *   3. Logged in -> the app frame (AppShell) with the page for the current address
 *      (/login and /signup then just go to the dashboard)
 *
 * Addresses (routes):
 *   /                      Dashboard
 *   /jobs                  Jobs list
 *   /jobs/new              Create a job by hand
 *   /jobs/:jobId/edit      Edit a job
 *   /jobs/:jobId[/tab]     One job, with tabs (see pages/JobPage.tsx)
 *   /candidates            All candidates
 *   /outreach              Email campaigns
 *   /profile               Change your name / password
 *   /activity[/tab]        Activity log, token usage, token dashboard
 *   anything else          "Page not found"
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppShell } from './layout/AppShell';
import { ActivityPage, ActivityTab, RemainingUsageTab, TokenDashboardTab, TokenUsageTab } from './pages/ActivityPage';
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
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordResetPages';
import { ProfilePage } from './pages/ProfilePage';
import { SignupPage } from './pages/SignupPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { JobsPage } from './pages/JobsPage';
import { EditJobPage, NewJobPage } from './pages/NewJobPage';
import { CandidatesPage, NotFoundPage, OutreachPage } from './pages/SimplePages';

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

  if (status === 'signed-out') {
    return (
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        {/* Anything else (including "/") -> log in. */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Already logged in: these pages make no sense, go to the dashboard. */}
      <Route path="login" element={<Navigate to="/" replace />} />
      <Route path="signup" element={<Navigate to="/" replace />} />
      <Route path="forgot-password" element={<Navigate to="/" replace />} />
      <Route path="verify-email" element={<Navigate to="/" replace />} />
      {/* A reset link opened while logged in still works. */}
      <Route path="reset-password" element={<ResetPasswordPage />} />
      {/* Every page below is shown inside the app frame (top bar, sidebar, chat). */}
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="jobs/new" element={<NewJobPage />} />
        <Route path="jobs/:jobId/edit" element={<EditJobPage />} />
        <Route path="jobs/:jobId" element={<JobPage />}>
          <Route index element={<JobCandidatesTab />} />
          <Route path="pipeline" element={<JobPipelineTab />} />
          <Route path="replies" element={<JobRepliesTab />} />
          <Route path="emails" element={<JobEmailsTab />} />
          <Route path="activity" element={<JobActivityTab />} />
        </Route>
        <Route path="candidates" element={<CandidatesPage />} />
        <Route path="outreach" element={<OutreachPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="activity" element={<ActivityPage />}>
          <Route index element={<ActivityTab />} />
          <Route path="token-usage" element={<TokenUsageTab />} />
          <Route path="token-dashboard" element={<TokenDashboardTab />} />
          <Route path="remaining-usage" element={<RemainingUsageTab />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
