import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react/dist/csr/Plus';
import { PixelComputer } from '../../components/PixelComputer';
import { Modal } from '../../components/Modal';
import { FormError } from '../auth/FormParts';
import {
  localToday,
  priorityLabels,
  statuses,
  statusLabels,
  taskSchema,
  type TaskPreview,
} from './contracts';
import { useTaskApi, useTasks, useTags } from './queries';
import { TaskEditor } from './TaskEditor';
import { TagManager } from './TagManager';
import { useTaskShortcuts } from './useTaskShortcuts';
export function TaskBoard({
  workspaceId,
  canEdit,
}: {
  workspaceId: string;
  canEdit: boolean;
}) {
  const { request, refresh } = useTaskApi(workspaceId);
  const [params, setParams] = useSearchParams();
  const selected = params.get('task');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [sort, setSort] = useState('due_at');
  const [tag, setTag] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [direction, setDirection] = useState('asc');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  useEffect(() => {
    if (search === debouncedSearch) return;
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, debouncedSearch]);
  const query = useTasks(workspaceId, {
    search: debouncedSearch,
    statuses:
      status === 'all'
        ? []
        : status === 'active'
          ? ['to do', 'in_progress', 'blocked']
          : [status as TaskPreview['status']],
    tagIds: tag ? [tag] : [],
    dueFrom,
    dueTo,
    orderBy: sort,
    direction,
    offset,
  });
  const tagQuery = useTags(workspaceId);
  // After deleting the last row of a page, return to the nearest valid page.
  if (query.data && offset > 0 && offset >= query.data.total) {
    setOffset(Math.max(0, Math.ceil(query.data.total / 50) - 1) * 50);
  }
  const [manageTags, setManageTags] = useState(false);
  const [help, setHelp] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const completionFocus = useRef<number | null>(null);
  const searchFocusPending = useRef(false);
  const leaveSearch = () => {
    if (search !== debouncedSearch || query.isFetching) {
      searchFocusPending.current = true;
      searchRef.current?.blur();
    } else {
      const first =
        listRef.current?.querySelector<HTMLButtonElement>('[data-open-task]');
      if (first) first.focus();
      else searchRef.current?.blur();
    }
  };
  useEffect(() => {
    if (
      !searchFocusPending.current ||
      search !== debouncedSearch ||
      query.isFetching
    )
      return;
    searchFocusPending.current = false;
    if (
      document.activeElement === document.body &&
      !document.querySelector('dialog[open]')
    ) {
      (
        listRef.current?.querySelector<HTMLButtonElement>('[data-open-task]') ||
        searchRef.current
      )?.focus();
    }
  }, [search, debouncedSearch, query.isFetching, query.data]);

  useEffect(() => {
    if (completionFocus.current === null) return;
    const rows =
      listRef.current?.querySelectorAll<HTMLButtonElement>('[data-open-task]');
    const next = rows?.[Math.min(completionFocus.current, rows.length - 1)];
    (next || searchRef.current)?.focus();
    completionFocus.current = null;
  }, [query.data]);
  useEffect(() => {
    if (selected || !trigger.current) return;
    const element = trigger.current;
    const frame = requestAnimationFrame(() => {
      if (element.isConnected) element.focus();
      else newRef.current?.focus();
      trigger.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [selected]);
  const toggle = useMutation({
    onMutate: (task: TaskPreview) => {
      const rows = [
        ...(listRef.current?.querySelectorAll<HTMLButtonElement>(
          '[data-open-task]',
        ) || []),
      ];
      const index = rows.findIndex((row) => row.dataset.openTask === task.id);
      if (
        index >= 0 &&
        rows[index]
          ?.closest('[data-task-row]')
          ?.contains(document.activeElement)
      )
        completionFocus.current = index;
    },
    onError: () => {
      completionFocus.current = null;
    },
    mutationFn: (task: TaskPreview) =>
      request(`/tasks/${task.id}`, taskSchema, {
        method: 'PATCH',
        body: { status: task.status === 'done' ? 'to do' : 'done' },
      }),
    onSuccess: () => refresh(),
  });
  const open = (id: string, element?: HTMLElement) => {
    trigger.current = element || (document.activeElement as HTMLElement);
    const next = new URLSearchParams(params);
    next.set('task', id);
    setParams(next);
  };
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete('task');
    setParams(next, { replace: true });
  };
  const visible = query.data?.tasks || [];
  const tags = tagQuery.data?.tags || [];
  const counts = query.data?.counts;
  const total = query.data?.total || 0;
  useTaskShortcuts({
    enabled: !selected && !manageTags && !help,
    canEdit,
    busy: toggle.isPending,
    listRef,
    searchRef,
    onCreate: () => open('new'),
    onHelp: () => setHelp(true),
    onLeaveSearch: leaveSearch,
    onToggle: (id) => {
      const task = visible.find((item) => item.id === id);
      if (task) toggle.mutate(task);
    },
  });
  return (
    <section className="task-board" aria-label="Workspace tasks">
      <div className="task-toolbar">
        <div>
          <p className="eyebrow">YOUR NEXT SMALL VICTORY</p>
          <h2>
            Things to do
            <span className="task-count">{counts?.total ?? '—'}</span>
          </h2>
        </div>
        <div className="task-actions">
          <button
            className="secondary"
            onClick={() => setHelp(true)}
            aria-label="Keyboard shortcuts"
          >
            ?
          </button>
          {canEdit && (
            <>
              <button className="secondary" onClick={() => setManageTags(true)}>
                Manage tags
              </button>
              <button
                ref={newRef}
                className="primary"
                onClick={(event) => open('new', event.currentTarget)}
              >
                <Plus size={16} aria-hidden="true" /> New task
              </button>
            </>
          )}
        </div>
      </div>
      <div className="task-summary">
        <span>{counts?.active ?? '—'} open</span>
        <span>{counts?.done ?? '—'} done</span>
        <span>{counts?.archived ?? '—'} archived</span>
      </div>
      <div className="task-filters">
        <label className="field task-search">
          Search tasks
          <input
            ref={searchRef}
            type="search"
            maxLength={80}
            placeholder="Find your next thing…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                leaveSearch();
              }
            }}
          />
        </label>
        <label className="field">
          Show
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setOffset(0);
            }}
          >
            <option value="active">Active</option>
            <option value="all">All tasks</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {statusLabels[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Sort by
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setOffset(0);
            }}
          >
            <option value="due_at">Due date</option>
            <option value="priority">Priority</option>
            <option value="title">Title</option>
            <option value="status">Status</option>
          </select>
        </label>
        <label className="field">
          Filter tag
          <select
            value={tag}
            onChange={(event) => {
              setTag(event.target.value);
              setOffset(0);
            }}
          >
            <option value="">All tags</option>
            {tags.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="task-filters">
        <label className="field">
          Direction
          <select
            value={direction}
            onChange={(event) => {
              setDirection(event.target.value);
              setOffset(0);
            }}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
        <label className="field">
          Due from
          <input
            type="date"
            value={dueFrom}
            max={dueTo || undefined}
            onChange={(event) => {
              setDueFrom(event.target.value);
              setOffset(0);
            }}
          />
        </label>
        <label className="field">
          Due through
          <input
            type="date"
            value={dueTo}
            min={dueFrom || undefined}
            onChange={(event) => {
              setDueTo(event.target.value);
              setOffset(0);
            }}
          />
        </label>
      </div>
      <FormError message={query.error?.message || toggle.error?.message} />
      {query.isError && (
        <button className="secondary" onClick={() => void query.refetch()}>
          Retry tasks
        </button>
      )}
      {query.isPending ? (
        <p className="task-empty" role="status">
          Gathering your tasks…
        </p>
      ) : !query.isError && counts?.total === 0 ? (
        <div className="task-empty">
          <PixelComputer large />
          <h3>A clear screen. A fresh start.</h3>
          <p>Big ideas begin with one small thing.</p>
          {canEdit && (
            <button
              className="secondary"
              onClick={(event) => open('new', event.currentTarget)}
            >
              Add your first task
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="task-results" aria-live="polite">
            {visible.length} of {total} tasks
            {total > 50 &&
              ` · page ${Math.floor(offset / 50) + 1} of ${Math.ceil(total / 50)}`}
          </p>
          {!visible.length && (
            <div className="task-empty">
              <h3>Nothing in this view.</h3>
              <p>Try another search or open up your filters.</p>
              <button
                className="secondary"
                onClick={() => {
                  setSearch('');
                  setTag('');
                  setStatus('all');
                  setDueFrom('');
                  setDueTo('');
                  setOffset(0);
                }}
              >
                Show all tasks
              </button>
            </div>
          )}
          <ul className="task-list" ref={listRef}>
            {visible.map((task) => (
              <li
                data-task-row
                key={task.id}
                className={
                  task.status === 'done' ? 'task-row task-done' : 'task-row'
                }
              >
                {canEdit && (
                  <button
                    className="task-check"
                    disabled={toggle.isPending}
                    aria-label={`${task.status === 'done' ? 'Reopen' : 'Complete'} ${task.title}`}
                    aria-pressed={task.status === 'done'}
                    onClick={() => toggle.mutate(task)}
                  >
                    {task.status === 'done' ? '✓' : ''}
                  </button>
                )}
                <button
                  data-open-task={task.id}
                  className="task-open"
                  onClick={(event) => open(task.id, event.currentTarget)}
                >
                  <span className="task-row-title">{task.title}</span>
                  <span className="task-row-meta">
                    <span className="task-status" data-status={task.status}>
                      {statusLabels[task.status]}
                    </span>
                    <span>{priorityLabels[task.priority]}</span>
                    <time
                      className={
                        task.due_at < localToday() &&
                        !['done', 'archived'].includes(task.status)
                          ? 'task-overdue'
                          : ''
                      }
                      dateTime={task.due_at}
                    >
                      {task.due_at}
                    </time>
                    {task.tags.tags.map((item) => (
                      <span className="task-tag" key={item.id}>
                        {item.name}
                      </span>
                    ))}
                  </span>
                </button>
                <span className="task-row-arrow" aria-hidden="true">
                  ↗
                </span>
              </li>
            ))}
          </ul>
          {total > 50 && (
            <nav className="task-actions" aria-label="Task pages">
              <button
                className="secondary"
                disabled={offset === 0 || query.isFetching}
                onClick={() => setOffset((value) => Math.max(0, value - 50))}
              >
                Previous page
              </button>
              <button
                className="secondary"
                disabled={offset + 50 >= total || query.isFetching}
                onClick={() => setOffset((value) => value + 50)}
              >
                Next page
              </button>
            </nav>
          )}
        </>
      )}
      <p className="task-key-hint">
        <kbd>j</kbd>
        <kbd>k</kbd> move <kbd>l</kbd> open <kbd>x</kbd> complete <kbd>/</kbd>{' '}
        search <kbd>a</kbd> add
      </p>
      {selected &&
        (selected === 'new' ? (
          canEdit && (
            <TaskEditor
              workspaceId={workspaceId}
              canEdit={canEdit}
              onClose={close}
            />
          )
        ) : /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(selected) ? (
          <TaskEditor
            taskId={selected}
            workspaceId={workspaceId}
            canEdit={canEdit}
            onClose={close}
          />
        ) : (
          <Modal title="Task unavailable" onClose={close}>
            <p role="alert">This task address is invalid.</p>
          </Modal>
        ))}
      {manageTags && (
        <TagManager
          workspaceId={workspaceId}
          onClose={() => setManageTags(false)}
        />
      )}
      {help && (
        <Modal
          title="Keep your hands on the keys."
          onClose={() => setHelp(false)}
        >
          <dl className="task-shortcuts">
            <dt>j / k or ↓ / ↑</dt>
            <dd>Move through task rows</dd>
            <dt>l / Enter</dt>
            <dd>Open the focused task</dd>
            <dt>x</dt>
            <dd>Complete or reopen the focused task</dd>
            <dt>a</dt>
            <dd>Add a task</dd>
            <dt>/</dt>
            <dd>Focus search</dd>
            <dt>Ctrl / ⌘ + Enter</dt>
            <dd>Save in the task editor</dd>
            <dt>Escape</dt>
            <dd>Close a dialog; confirm unsaved edits</dd>
          </dl>
          <p className="field-hint">
            Shortcuts work anywhere on this task page and pause while you type
            or use a dialog. Escape leaves search.
          </p>
        </Modal>
      )}
    </section>
  );
}
