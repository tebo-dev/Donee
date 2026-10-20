# Donee frontend

Donee's React, TypeScript, and Vite frontend. Includes registration, sign-in, password recovery, account details, workspace browsing, creation, and renaming, and individual task workflows. Appearance settings offer Matrix, Terminal, Dracula, and Akira themes, plus IBM Plex Mono and Fira Code for inputs and small details.

## Development

Use Node.js 24 (see `.nvmrc`) and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Keep the terminal running while using the site. Vite fails explicitly if that port is occupied.

Start the FastAPI backend separately with its database and mail provider configured. Copy `.env.example` to `.env.local` when local configuration is needed. `/api` requests are proxied to FastAPI at http://127.0.0.1:8000 during development. `API_PROXY_TARGET` changes that target. The API client reads `VITE_API_BASE_URL`. Never put secrets in `VITE_` variables.

Use `/login` or `/register` to get started. Password recovery begins at `/forgot-password` and uses the six-digit code delivered by the backend's email service. In development, the backend sends email to its configured development recipient. Recovery details stay in memory; keep the tab open until the reset is complete. `/account` requires a server-verified session.

Sign-in opens `/workspaces`. Search the list, create a space, or open one at `/workspaces/:id`. Owners can rename a workspace in `/workspaces/:id/settings`; changes are saved through the API. On the list, focus a workspace row and use `j`/`k`, arrow keys, Home/End, and Enter to navigate. Arrow Down moves from the search field to the first result. Escape closes the creation dialog when a save is not in progress.

The current backend lists only owned workspaces. Accessible shared spaces can be opened by direct link, with read-only settings when ownership cannot be confirmed. Workspace deletion, invitations, and membership management have no API endpoints and are not offered. Task tools use persisted API data. Collaboration controls are deferred.

The access token is stored in this tab's session storage and verified through `/auth/me` after a reload, on window focus, and periodically. It expires according to the backend's token lifetime. Sign-out clears this tab's token and cached data. The current backend provides no refresh-token or logout/revocation endpoint; password reset invalidates older tokens. No persistent “remember me” option is provided.

## Tasks

Open a workspace to search, filter by status/tag, and sort tasks by date, priority, title, or status. Search covers all task pages returned by the API and matches titles. Active tasks are shown by default; choose All tasks, Done, or Archived to see the others. A task can be reopened, archived, or permanently deleted with confirmation. Task links use `/workspaces/:id?task=:taskId`.

The editor supports title (2–80 characters), description (up to 10,000), a required due date, priority, and workspace tags. New tasks begin in To do. Priority defaults to 2 / Normal; the UI offers 1 / High and 3 / Low and preserves existing custom integer values. Dates remain calendar dates without timezone shifts. Only changed fields are patched, preserving completion dates when editing other details. Failed saves preserve the draft; closing a dirty form asks before discarding it.

Manage tags from the task toolbar. Tags can be created, renamed, recolored, assigned, unassigned, and deleted. Deleting a tag removes its task assignments. Names and colors must be unique within the workspace according to the API.

Saved tasks accept HTTP(S) links and PDF, PNG, JPEG, WebP, or text files up to 10 MB. File uploads use the server's presigned multipart POST, followed by server verification. A pending upload can be verified again; failed entries can be removed before retrying. Downloads request a short-lived link. Renaming and deleting attachments use the existing API. Configure the storage bucket to accept uploads from the frontend origin.

Within the task area, `j`/`k` or arrows move through rows, `l`/Enter opens a task, `x` completes/reopens, `/` focuses search, and `a` creates a task. Single-key shortcuts pause in editable controls. Ctrl/Cmd+Enter saves the editor; Escape closes it or asks to discard a draft. Every shortcut has a visible control equivalent. The `?` button lists the keys.

Separate notes, comments, recurrence, reminders, subtasks, task assignment, and projects are not exposed by the current task API and are not offered. Description is the supported task text field. Editing is enabled for owned workspaces; the server enforces permissions on every operation.

## Checks

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` runs formatting, linting, unit tests, TypeScript, and the production build. Browser tests serve the built frontend on port 4173 and run the existing FastAPI app on port 8011 with a temporary SQLite database and captured email delivery. A fixed `123456` code is used only inside that test process. They exercise real auth, workspace, task, tag, and attachment operations, persistence, access denial, and viewer permissions. File tests replace only the external object store with an in-memory adapter in the isolated test process; live S3 signing, bucket CORS, and production storage configuration need environment verification. Test-only viewer membership is seeded directly in the temporary database because membership management has no public API. Empty-list and network-error scenarios use intercepted responses; production components always call the API. Tests also check keyboard behavior, narrow layouts, and automated accessibility. Mailgun delivery and production PostgreSQL behavior require separate environment verification.

Browser tests require the backend's Python dependencies. By default they use `../venv/Scripts/python.exe` on Windows or `../venv/bin/python` elsewhere. Set `DONEE_TEST_PYTHON` to use another Python interpreter. Both test ports must be free. The isolated API runner is test-only and is not part of the built frontend.

Use `npm run format` to format changes, `npm run test:watch` for unit tests, and `npm run test:e2e:ui` for browser debugging.

## Structure and tooling

- `src/app`: application routing and shared providers.
- `src/components`: appearance controls, brand, and pixel computer.
- `src/features/auth`: auth pages, form validation, session handling, and recovery flow.
- `src/features/workspaces`: workspace pages, server-state queries, validation, and mutations.
- `src/features/tasks`: task lists, editing, tags, attachments, and keyboard workflows.
- `src/lib`: API transport and error handling.
- `src/pages`: missing-route page.
- `src/styles`: theme tokens and global styles.
- `src/test` and `e2e`: component and browser test setup.
- React Router handles routes; TanStack Query caches server state by signed-in user and refreshes it after changes.
- React Hook Form and Zod validate auth forms against the backend's contracts.
- Phosphor icons and locally bundled fonts support the approved design.

Production output is in `dist`. Configure the production host to serve `index.html` for application routes and route `/api` to the backend, or configure an API base URL at build time. The Vite development proxy is not a production API server.

The previous frontend remains recoverable from Git at commit `e6faefa`. The design-study prototype remains separate from this application; its mock authentication and task data are not production implementations.
