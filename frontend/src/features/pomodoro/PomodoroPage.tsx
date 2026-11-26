import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Play } from '@phosphor-icons/react/dist/csr/Play';
import { Pause } from '@phosphor-icons/react/dist/csr/Pause';
import { ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { useWorkspaces } from '../workspaces/queries';
import { initialTaskFilters, useTasks } from '../tasks/queries';
import { statusLabels } from '../tasks/contracts';
import { usePomodoro } from './pomodoro-context';
import { PixelClock } from './PixelClock';
import { duration, formatTime } from './timer';
import '../../styles/pomodoro.css';

function IncompleteTasks({ workspaceId }: { workspaceId: string }) {
  const [offset, setOffset] = useState(0);
  const query = useTasks(workspaceId, { ...initialTaskFilters, offset });
  if (query.data && offset > 0 && offset >= query.data.total) {
    setOffset(Math.max(0, Math.ceil(query.data.total / 50) - 1) * 50);
  }
  if (query.isPending) return <p role="status">Loading tasks…</p>;
  if (query.isError)
    return (
      <div>
        <p role="alert">Tasks could not be loaded.</p>
        <button className="secondary" onClick={() => void query.refetch()}>
          Retry tasks
        </button>
      </div>
    );
  return (
    <>
      <div className="pomodoro-task-heading">
        <h2>Incomplete tasks</h2>
        <span>{query.data.total}</span>
      </div>
      {query.data.total === 0 ? (
        <p>No incomplete tasks in this workspace.</p>
      ) : (
        <ul
          className="pomodoro-task-list"
          tabIndex={0}
          aria-label="Incomplete tasks"
        >
          {query.data.tasks.map((task) => (
            <li key={task.id}>
              <span className="pomodoro-task-dot" aria-hidden="true" />
              <span>{task.title}</span>
              <span className="pomodoro-task-status">
                {statusLabels[task.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
      {query.data.total > 50 && (
        <nav className="pomodoro-pagination" aria-label="Task pages">
          <button
            className="secondary"
            disabled={offset === 0 || query.isFetching}
            onClick={() => setOffset(offset - 50)}
          >
            Previous
          </button>
          <span>
            Page {offset / 50 + 1} of {Math.ceil(query.data.total / 50)}
          </span>
          <button
            className="secondary"
            disabled={offset + 50 >= query.data.total || query.isFetching}
            onClick={() => setOffset(offset + 50)}
          >
            Next
          </button>
        </nav>
      )}
    </>
  );
}

export function PomodoroPage() {
  const { state, dispatch, workspaceId, setWorkspaceId } = usePomodoro();
  const workspaces = useWorkspaces();
  const location = useLocation();
  const from: unknown = location.state?.from;
  const backTo =
    typeof from === 'string' && /^\/workspaces(?:[/?]|$)/.test(from)
      ? from
      : '/workspaces';
  const selected = workspaces.data?.workspaces.find(
    (item) => item.id === workspaceId,
  );
  const running = state.deadline !== null;
  const paused =
    !running && state.remainingMs < duration(state.preset, state.phase);
  return (
    <main id="main-content" tabIndex={-1} className="pomodoro-page">
      <section
        className="pomodoro-clock-section"
        aria-labelledby="pomodoro-title"
      >
        <h1 id="pomodoro-title">Pomodoro</h1>
        <p className="pomodoro-phase">
          {state.phase === 'focus' ? 'Focus' : 'Break'}
          {paused ? ' · Paused' : ''}
        </p>
        <PixelClock time={formatTime(state.remainingMs)} />
        <fieldset className="pomodoro-presets" disabled={running}>
          <legend>Focus / break · minutes</legend>
          {([25, 50] as const).map((preset) => (
            <label key={preset}>
              <input
                type="radio"
                name="pomodoro-duration"
                value={preset}
                checked={state.preset === preset}
                onChange={() => dispatch({ type: 'preset', preset })}
              />
              <span>
                {preset} / {preset / 5}
              </span>
            </label>
          ))}
        </fieldset>
        <div className="pomodoro-controls">
          <button
            className="primary"
            onClick={() =>
              dispatch({ type: running ? 'pause' : 'start', now: Date.now() })
            }
          >
            {running ? (
              <Pause size={17} aria-hidden="true" />
            ) : (
              <Play size={17} aria-hidden="true" />
            )}
            {running
              ? 'Pause'
              : `${paused ? 'Resume' : 'Start'} ${state.phase}`}
          </button>
          <button
            className="secondary"
            onClick={() => dispatch({ type: 'reset' })}
          >
            <ArrowCounterClockwise size={17} aria-hidden="true" />
            Reset
          </button>
        </div>
        <p className="pomodoro-announcement" role="status">
          {state.announcement ||
            'Start each focus and break when you are ready.'}
        </p>
      </section>
      <section className="pomodoro-tasks" aria-label="Tasks for this session">
        <label
          className="pomodoro-workspace-label"
          htmlFor="pomodoro-workspace"
        >
          Workspace
        </label>
        {workspaces.isPending ? (
          <p role="status">Loading workspaces…</p>
        ) : workspaces.isError ? (
          <div>
            <p role="alert">Workspaces could not be loaded.</p>
            <button
              className="secondary"
              onClick={() => void workspaces.refetch()}
            >
              Retry workspaces
            </button>
          </div>
        ) : (
          <>
            <select
              id="pomodoro-workspace"
              value={selected?.id || ''}
              onChange={(event) => setWorkspaceId(event.target.value)}
            >
              <option value="">Choose a workspace</option>
              {workspaces.data.workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            {selected ? (
              <IncompleteTasks key={selected.id} workspaceId={selected.id} />
            ) : (
              <p>
                {workspaces.data.workspaces.length
                  ? 'Choose a workspace to see its incomplete tasks.'
                  : 'No workspaces yet.'}
              </p>
            )}
          </>
        )}
      </section>
      <Link className="pomodoro-back" to={backTo}>
        Back to workspace
      </Link>
    </main>
  );
}
