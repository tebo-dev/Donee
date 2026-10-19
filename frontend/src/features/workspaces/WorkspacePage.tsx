import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { FolderSimple } from '@phosphor-icons/react/dist/csr/FolderSimple';
import { GearSix } from '@phosphor-icons/react/dist/csr/GearSix';
import { useWorkspace, useWorkspaces } from './queries';
import { createdDate } from './contracts';
import { WorkspaceError } from './WorkspaceError';
import { RenameWorkspace } from './RenameWorkspace';
import { PixelComputer } from '../../components/PixelComputer';

export function WorkspacePage({ settings = false }: { settings?: boolean }) {
  const { workspaceId = '' } = useParams();
  const query = useWorkspace(workspaceId);
  const owned = useWorkspaces();
  const location = useLocation();
  const created = Boolean(
    (location.state as { created?: boolean } | null)?.created,
  );
  if (!query.valid) return <WorkspaceError />;
  if (query.isPending)
    return (
      <p className="workspace-loading" role="status">
        Opening your little corner…
      </p>
    );
  if (query.isError)
    return (
      <WorkspaceError
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  const workspace = query.data;
  // The current list endpoint returns only owned workspaces. Detail responses do not expose a role or owner ID.
  const canRename =
    owned.isSuccess &&
    owned.data.workspaces.some((item) => item.id === workspace.id);
  return (
    <>
      <div className="workspace-breadcrumb">
        <Link to="/workspaces">~/spaces</Link>
        <span>/</span>
        <span className="breadcrumb-name">{workspace.name}</span>
        {settings && (
          <>
            <span>/</span>settings
          </>
        )}
      </div>
      <header className="workspace-page-heading">
        <div>
          <p className="eyebrow">
            {settings
              ? 'MAKE IT FEEL LIKE YOURS'
              : 'YOUR LITTLE CORNER OF THE INTERNET'}
          </p>
          <h1>{workspace.name}</h1>
          <p>
            {settings
              ? 'A name, a little identity. The details of your space.'
              : 'A little room for whatever comes next.'}
          </p>
        </div>
        <span className="workspace-heading-icon" aria-hidden="true">
          <FolderSimple size={36} weight="duotone" />
        </span>
      </header>
      {created && !settings && (
        <p className="workspace-success" role="status">
          Your new workspace is ready. Make yourself at home.
        </p>
      )}
      <nav className="workspace-tabs" aria-label="Current workspace">
        <Link
          to={`/workspaces/${workspace.id}`}
          aria-current={settings ? undefined : 'page'}
        >
          Overview
        </Link>
        {(canRename || settings) && (
          <Link
            to={`/workspaces/${workspace.id}/settings`}
            aria-current={settings ? 'page' : undefined}
          >
            <GearSix size={15} aria-hidden="true" />
            Settings
          </Link>
        )}
      </nav>
      {settings ? (
        <section className="workspace-settings" aria-label="Workspace settings">
          <div className="settings-copy">
            <p className="eyebrow">01 / GENERAL</p>
            <h2>A name of its own.</h2>
            <p>
              Change the name without changing the space. Your workspace address
              stays the same.
            </p>
          </div>
          <div className="settings-form-panel">
            {canRename ? (
              <RenameWorkspace key={workspace.id} workspace={workspace} />
            ) : owned.isPending ? (
              <p role="status">Checking edit access…</p>
            ) : owned.isError ? (
              <>
                <p role="alert">
                  We couldn't confirm edit access. Your workspace hasn't been
                  changed.
                </p>
                <button
                  className="secondary"
                  onClick={() => {
                    void owned.refetch();
                  }}
                >
                  Check again
                </button>
              </>
            ) : (
              <p className="settings-readonly">
                You can view this workspace. Only its owner can change the name.
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="workspace-ready" aria-labelledby="ready-title">
          <PixelComputer large />
          <p className="eyebrow">ROOM FOR YOUR NEXT IDEA</p>
          <h2 id="ready-title">
            Good things start
            <br />
            <span>with a little space.</span>
          </h2>
          <p>This corner is yours. Task tools are coming next.</p>
          {canRename && (
            <Link
              className="workspace-inline-link"
              to={`/workspaces/${workspace.id}/settings`}
            >
              Make it feel like yours{' '}
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          )}
        </section>
      )}
      <dl className="workspace-facts">
        <div>
          <dt>Created</dt>
          <dd>{createdDate(workspace.created_at)}</dd>
        </div>
        <div>
          <dt>Workspace ID</dt>
          <dd>{workspace.id}</dd>
        </div>
      </dl>
      <Link className="workspace-back" to="/workspaces">
        <ArrowLeft size={15} aria-hidden="true" />
        Back to all spaces
      </Link>
    </>
  );
}
