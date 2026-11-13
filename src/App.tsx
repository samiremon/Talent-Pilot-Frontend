/**
 * Top of the app: decides which screen to show based on the login status.
 *   loading     -> a short "Loading…" while we ask the backend who's logged in
 *   signed-out  -> the login page
 *   signed-in   -> the home page
 */
import { useAuth } from './auth/AuthContext';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';

export function App() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <main className="page">
        <p className="muted" role="status">
          Loading…
        </p>
      </main>
    );
  }

  return status === 'signed-in' ? <HomePage /> : <LoginPage />;
}
