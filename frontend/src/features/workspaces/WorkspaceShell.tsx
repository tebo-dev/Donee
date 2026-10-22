import { useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { FolderSimple } from '@phosphor-icons/react/dist/csr/FolderSimple';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { SquaresFour } from '@phosphor-icons/react/dist/csr/SquaresFour';
import { SignOut } from '@phosphor-icons/react/dist/csr/SignOut';
import { UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle';
import { useAuth } from '../auth/auth-context';
import { PixelComputer } from '../../components/PixelComputer';
import { useWorkspaces } from './queries';
import { CreateWorkspace } from './CreateWorkspace';

export function WorkspaceShell() {
  const { session, signOut, signingOut } = useAuth();
  const workspaces = useWorkspaces();
  const [creating, setCreating] = useState(false);
  const createTrigger = useRef<HTMLElement | null>(null);
  function createWorkspace(trigger?: HTMLElement) {
    createTrigger.current =
      trigger ||
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    setCreating(true);
  }
  function closeCreate(restoreFocus = true) {
    setCreating(false);
    const trigger = createTrigger.current;
    if (restoreFocus)
      requestAnimationFrame(() => {
        if (trigger?.isConnected) trigger.focus();
      });
  }
  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar" aria-label="Your spaces">
        <div className="sidebar-intro">
          <span className="eyebrow">YOUR PERSONAL ORBIT</span>
          <p title={session.user?.username}>
            {session.user?.username}
            <span aria-hidden="true">_</span>
          </p>
        </div>
        <nav aria-label="Workspace navigation">
          <NavLink className="sidebar-link" to="/workspaces" end>
            <SquaresFour size={17} aria-hidden="true" />
            All spaces
            {workspaces.data && (
              <span className="sidebar-count">
                {workspaces.data.workspaces.length}
              </span>
            )}
          </NavLink>
        </nav>
        <div className="sidebar-section-heading">
          <span>WORKSPACES</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Create a workspace"
            onClick={(event) => createWorkspace(event.currentTarget)}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
        <nav className="sidebar-spaces" aria-label="Switch workspace">
          {workspaces.isPending && (
            <p className="sidebar-note">Finding your spaces…</p>
          )}
          {workspaces.isError && (
            <p className="sidebar-note">
              Spaces couldn't load.{' '}
              <button
                className="text-button"
                onClick={() => {
                  void workspaces.refetch();
                }}
              >
                Retry list
              </button>
            </p>
          )}
          {workspaces.data?.workspaces.map((workspace) => (
            <NavLink
              key={workspace.id}
              className="sidebar-link"
              to={`/workspaces/${workspace.id}`}
              title={workspace.name}
            >
              <FolderSimple size={16} aria-hidden="true" />
              <span className="workspace-name">{workspace.name}</span>
            </NavLink>
          ))}
          {workspaces.data?.workspaces.length === 0 && (
            <p className="sidebar-note">
              A fresh start. Make a space of your own.
            </p>
          )}
        </nav>
        <button
          className="sidebar-create"
          onClick={(event) => createWorkspace(event.currentTarget)}
        >
          <Plus size={15} aria-hidden="true" />
          New workspace
        </button>
        <div className="sidebar-companion">
          <PixelComputer />
          <p>
            A little room.
            <br />A little forward motion.
          </p>
        </div>
        <div className="sidebar-account">
          <Link className="sidebar-link" to="/account">
            <UserCircle size={17} aria-hidden="true" />
            Your account
          </Link>
          <button
            className="sidebar-link"
            disabled={signingOut}
            onClick={() => {
              void signOut();
            }}
          >
            <SignOut size={17} aria-hidden="true" />
            Sign out of this tab
          </button>
        </div>
      </aside>
      <main id="main-content" className="workspace-main" tabIndex={-1}>
        <Outlet context={{ createWorkspace }} />
      </main>
      {creating && <CreateWorkspace onClose={closeCreate} />}
    </div>
  );
}
