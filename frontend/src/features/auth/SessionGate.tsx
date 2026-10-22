import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';

export function SessionGate({ guest = false }: { guest?: boolean }) {
  const { session, retry, signOut, signingOut } = useAuth();
  const location = useLocation();
  const Container = guest ? 'section' : 'main';
  const contentId = guest ? undefined : 'main-content';
  if (session.status === 'loading')
    return (
      <Container id={contentId} className="session-page" tabIndex={-1}>
        <p role="status">Finding your little corner…</p>
      </Container>
    );
  if (session.status === 'unavailable')
    return (
      <Container id={contentId} className="session-page" tabIndex={-1}>
        <p className="eyebrow">CONNECTION INTERRUPTED</p>
        <h1>A small pause.</h1>
        <p>
          We couldn't check your session. Your sign-in is saved in this tab.
        </p>
        <div className="session-actions">
          <button className="primary" onClick={retry}>
            Try again
          </button>
          <button
            className="secondary"
            disabled={signingOut}
            onClick={() => {
              void signOut();
            }}
          >
            Return to sign in
          </button>
        </div>
      </Container>
    );
  if (guest && session.status === 'authenticated')
    return <Navigate to="/workspaces" replace state={location.state} />;
  if (!guest && session.status !== 'authenticated')
    return <Navigate to="/login" replace />;
  return <Outlet />;
}
