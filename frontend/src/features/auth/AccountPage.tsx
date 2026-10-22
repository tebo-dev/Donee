import { Link, useLocation } from 'react-router-dom';
import { PixelComputer } from '../../components/PixelComputer';
import { useAuth } from './auth-context';

export function AccountPage() {
  const { session, signOut, signingOut } = useAuth();
  const location = useLocation();
  const state = location.state as { passwordReset?: boolean } | null;
  return (
    <main id="main-content" className="session-page account-page" tabIndex={-1}>
      <PixelComputer large />
      <p className="eyebrow">CONNECTED / YOUR PERSONAL SPACE</p>
      <h1>
        You're home, <span>{session.user?.username}.</span>
      </h1>
      {state?.passwordReset && (
        <p className="form-message" role="status">
          Your password has been changed. You're signed in with your new
          session.
        </p>
      )}
      <p>
        Signed in as <strong>{session.user?.email}</strong>
      </p>
      <div className="next-stage">
        <span className="eyebrow">YOUR LITTLE CORNERS</span>
        <p>
          A place for your plans, your ideas, and the things you want to do.
        </p>
      </div>
      <Link className="primary account-spaces-link" to="/workspaces">
        Open your workspaces <span aria-hidden="true">↗</span>
      </Link>
      <button
        className="secondary"
        disabled={signingOut}
        onClick={() => {
          void signOut();
        }}
      >
        Sign out of this tab <span aria-hidden="true">↗</span>
      </button>
    </main>
  );
}
