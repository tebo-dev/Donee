import { useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { FolderSimple } from '@phosphor-icons/react/dist/csr/FolderSimple';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { useWorkspaces } from './queries';
import { useWorkspaceShell } from './workspace-context';
import { createdDate } from './contracts';
import { WorkspaceError } from './WorkspaceError';

export function WorkspaceListPage() {
  const query = useWorkspaces();
  const { createWorkspace } = useWorkspaceShell();
  const [filter, setFilter] = useState('');
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const spaces =
    query.data?.workspaces.filter((workspace) =>
      workspace.name
        .toLocaleLowerCase()
        .includes(filter.trim().toLocaleLowerCase()),
    ) || [];
  function navigateList(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
      return;
    const target = event.target;
    if (!(target instanceof HTMLAnchorElement)) return;
    const index = links.current.indexOf(target);
    let next: number;
    if (event.key === 'j' || event.key === 'ArrowDown')
      next = Math.min(spaces.length - 1, index + 1);
    else if (event.key === 'k' || event.key === 'ArrowUp')
      next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = spaces.length - 1;
    else return;
    event.preventDefault();
    links.current[next]?.focus();
  }
  if (query.isPending)
    return (
      <p className="workspace-loading" role="status">
        Finding your little corners…
      </p>
    );
  if (query.isError && !query.data)
    return (
      <WorkspaceError
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  return (
    <>
      <div className="workspace-breadcrumb">
        <span>~/</span> personal_space <span>/</span> workspaces
      </div>
      <header className="workspace-page-heading">
        <div>
          <p className="eyebrow">A PLACE FOR EVERY PART OF YOUR DAY</p>
          <h1>Your little corners.</h1>
          <p>
            Big plans, small errands, something just for you. Give each a little
            room.
          </p>
        </div>
        <button
          className="primary"
          onClick={(event) => createWorkspace(event.currentTarget)}
        >
          <Plus size={17} aria-hidden="true" />
          New workspace
        </button>
      </header>
      {query.isError && (
        <div className="workspace-refresh-error" role="alert">
          Your saved list is shown. We couldn't refresh it.{' '}
          <button
            className="text-button"
            onClick={() => {
              void query.refetch();
            }}
          >
            Retry list
          </button>
        </div>
      )}
      <section className="workspace-directory" aria-label="Your workspaces">
        <div className="directory-toolbar">
          <span className="directory-caption">
            YOUR SPACES{' '}
            <span>
              {String(query.data?.workspaces.length || 0).padStart(2, '0')}
            </span>
          </span>
          <div className="workspace-search">
            <MagnifyingGlass size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="Find a workspace"
              placeholder="Find a space…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  links.current[0]?.focus();
                }
              }}
            />
          </div>
        </div>
        {spaces.length > 0 ? (
          <div className="workspace-list" onKeyDown={navigateList}>
            {spaces.map((workspace, index) => (
              <Link
                key={workspace.id}
                ref={(node) => {
                  links.current[index] = node;
                }}
                className="workspace-row"
                to={`/workspaces/${workspace.id}`}
                aria-label={`Open ${workspace.name}`}
              >
                <span className="workspace-folder" aria-hidden="true">
                  <FolderSimple size={25} weight="duotone" />
                </span>
                <div className="workspace-row-name">
                  <h2>{workspace.name}</h2>
                  <p>Your own little space</p>
                </div>
                <span className="workspace-created">
                  Created {createdDate(workspace.created_at)}
                </span>
                <ArrowUpRight size={19} aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="workspace-empty">
            <FolderSimple size={36} aria-hidden="true" />
            <h2>
              {filter.trim()
                ? 'No space by that name.'
                : 'A fresh little start.'}
            </h2>
            <p>
              {filter.trim()
                ? 'Try a different name, or clear your search.'
                : 'Make your first workspace. Start with a name; the rest can follow.'}
            </p>
            {filter.trim() ? (
              <button className="secondary" onClick={() => setFilter('')}>
                Clear search
              </button>
            ) : (
              <button
                className="primary"
                onClick={(event) => createWorkspace(event.currentTarget)}
              >
                Create your first workspace
              </button>
            )}
          </div>
        )}
        <div className="directory-footer">
          <span>
            {spaces.length} {spaces.length === 1 ? 'space' : 'spaces'}
            {filter.trim() ? ' found' : ' to make your own'}
          </span>
          <span className="directory-keys">
            <kbd>j</kbd>
            <kbd>k</kbd> move <span>/</span>
            <kbd>↵</kbd> open
          </span>
        </div>
      </section>
      <p className="workspace-quiet-note">
        A place for the someday plans. And the things you'll do today.
      </p>
    </>
  );
}
