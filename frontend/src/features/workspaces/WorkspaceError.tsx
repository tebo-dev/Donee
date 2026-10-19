import { Link } from 'react-router-dom';
import { ApiError } from '../../lib/api';

export function WorkspaceError({
  error,
  retry,
}: {
  error?: Error | null;
  retry?: () => void;
}) {
  const unavailable =
    error instanceof ApiError && [403, 404, 422].includes(error.status);
  return (
    <div className="workspace-error">
      <p className="eyebrow">
        {unavailable || !retry ? 'SPACE UNAVAILABLE' : 'CONNECTION INTERRUPTED'}
      </p>
      <h1>
        {unavailable || !retry
          ? 'This corner is out of reach.'
          : 'A small pause.'}
      </h1>
      <p role="alert">
        {unavailable || !retry
          ? 'This workspace may not exist, or you may not have access to it.'
          : error?.message || 'Your spaces could not be loaded.'}
      </p>
      <div className="session-actions">
        {retry && !unavailable && (
          <button className="primary" onClick={retry}>
            Try again
          </button>
        )}
        <Link className="secondary" to="/workspaces">
          Back to all spaces
        </Link>
      </div>
    </div>
  );
}
