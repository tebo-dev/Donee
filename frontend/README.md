# Donee frontend

Donee's React, TypeScript, and Vite frontend. Includes registration, sign-in, password recovery, account details, workspace browsing, creation, renaming, and deletion, and individual task workflows. Appearance settings offer Matrix, Terminal, Dracula, and Akira themes, plus IBM Plex Mono and Fira Code for inputs and small details.

## Development

Use Node.js 24 (see `.nvmrc`) and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Keep the terminal running while using the site. Vite fails explicitly if that port is occupied.

Start the FastAPI backend separately with its database and mail provider configured. Copy `.env.example` to `.env.local` when local configuration is needed. `/api` requests are proxied to FastAPI at http://127.0.0.1:8000 during development. `API_PROXY_TARGET` changes that target. The API client reads `VITE_API_BASE_URL`. Never put secrets in `VITE_` variables.

Use `/login` or `/register` to get started. Password recovery begins at `/forgot-password` and uses the six-digit code delivered by the backend's email service. In development, the backend sends email to its configured development recipient. Recovery details stay in memory; keep the tab open until the reset is complete. `/account` requires a server-verified session.

Sign-in opens `/workspaces`. Search the list, create a space, or open one at `/workspaces/:id`. Owners can rename or permanently delete a workspace in `/workspaces/:id/settings`; changes are saved through the API. On the list, focus a workspace row and use `j`/`k`, arrow keys, Home/End, and Enter to navigate. Arrow Down moves from the search field to the first result. Escape closes the creation dialog when a save is not in progress.

The current backend lists only owned workspaces. Accessible shared spaces can be opened by direct link, with read-only settings when ownership cannot be confirmed. Invitations and membership management remain deferred. Deletion requires the workspace name as confirmation, waits for active attachment work, and offers retry if file cleanup fails. Task tools use persisted API data. Collaboration controls are deferred.

The access/refresh pair is stored together in this tab's session storage, with the lifetimes supplied by the server. Protected requests renew it before expiry or retry once after an unauthorized response; simultaneous requests share one rotation. A browser lock prevents duplicated tabs from sharing the same refresh credential. If locks or storage are unavailable, login stays in memory and a reload requires signing in again. Old access-only sessions are cleared. An uncertain refresh response ends the local session rather than replaying a potentially consumed credential. Sign-out calls the backend before clearing local credentials and caches; if the server cannot be reached, the UI reports that revocation could not be confirmed. Passwords and confirmations preserve every character, including surrounding spaces.

This frontend requires the updated backend schema, including string priorities and session tables. Apply the backend's pending migration as part of deployment before starting the updated application against an existing database. The frontend tests create a separate temporary schema; they do not migrate the developer database.

## Tasks

Open a workspace to search, filter by status/tag, and sort tasks by date, priority, title, or status. Search, status/tag filters, inclusive due-date ranges, and ascending/descending sorts run on the server. Search is debounced and obsolete requests are cancelled. Results load 50 at a time; page controls use the filtered total, while summary counts describe the entire workspace. Changing filters resets pagination. Active tasks are shown by default; choose All tasks, Done, or Archived to see the others. A task can be reopened, archived, or permanently deleted with confirmation. Task links use `/workspaces/:id?task=:taskId`.

The editor supports title (2–80 characters), description (up to 10,000), a required due date, priority, and workspace tags. New tasks begin in To do. Priority defaults to Normal; requests use the strings `high`, `normal`, and `low`. Dates remain calendar dates without timezone shifts. Only changed fields are patched, preserving completion dates when editing other details. Failed saves preserve the draft; closing a dirty form asks before discarding it.

Manage tags from the task toolbar. Tags can be created, renamed, recolored, assigned, unassigned, and deleted. Deleting a tag removes its task assignments. Names and colors must be unique within the workspace according to the API.

Saved tasks accept HTTP(S) links and PDF, PNG, JPEG, WebP, or text files up to 10 MB. File uploads use the server's presigned multipart POST, followed by server verification. A pending upload can be verified again; failed entries can be removed before retrying. Downloads request a short-lived link. Renaming and deleting attachments use the existing API. Configure the storage bucket to accept uploads from the frontend origin.

On a workspace task page, `j`/`k` or arrows move through rows, `l`/Enter opens a task, `x` completes/reopens, `/` focuses search, and `a` creates a task. Navigation can enter the list from elsewhere on the page. Single-key shortcuts pause in editable controls and all open dialogs; Escape leaves search and focuses the first result. Ctrl/Cmd+Enter saves the editor; Escape closes it or asks to discard a draft. Every shortcut has a visible control equivalent. The `?` button lists the keys.

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

## Legal documents and public contact

`legal/` contains the Markdown sources for the privacy policy, terms, acceptable-use policy, content-reporting policy, and browser-storage notice. `/legal` and `/legal/:document` render those same sources without raw HTML. The legal reader loads separately from the task and authentication screens. The operator approved these documents for launch with effective/version date 2026-10-26. Explicitly pending provider and operational details remain unresolved. Publication is not verification of those practices.

Set `VITE_LEGAL_CONTACT_EMAIL` in `.env.local` or the deployment build environment. Its current fallback is `its.tebo0@gmail.com`. This is public information, not a secret. Rebuild the frontend after changing it. The Markdown token `{{CONTACT_EMAIL}}` is replaced consistently in displayed text and email links. Do not replace it with a second hard-coded address in individual documents.

Registration requires an unchecked-by-default agreement to the Terms and incorporated Acceptable Use Policy, with a 13+ eligibility reminder. Privacy and Browser Storage are notices, not bundled optional-processing consent. The backend also requires `terms_accepted: true`, `terms_version`, and `acceptable_use_version` on registration. Missing, false, coerced, or stale agreement values are rejected. A `policy_acceptances` row stores the account ID, both accepted versions, and a database-generated timestamp atomically with account creation. No client timestamp, IP address, or user agent is collected for this receipt. This does not verify age or parental authority. Existing test users are not backfilled; deployment is intended for a fresh database. Product analytics and donation payments remain unimplemented; adding either requires updating the relevant notices and controls.

Appearance is remembered only when the user enables “Remember appearance on this device.” Existing stored theme/font choices are preserved. Turning remembering off removes that preference without clearing authentication. Public content-report links open an email composer with a category; they do not send messages or generate server-side cases.

## Production build configuration

The planned primary hostname is `donee.dev`. Cloudflare product selection, API hostname, DNS, provider regions (except S3 `us-east-2`), retention, and provider verification remains pending. No production services are provisioned by this repository change.

Use the `frontend` directory as the build root, install locked dependencies with `npm ci`, and run `npm run build:deploy`; publish `dist`. Set `VITE_API_BASE_URL` to the real HTTPS backend URL and `VITE_LEGAL_CONTACT_EMAIL` to the monitored public address in the build environment. Do not use the development `/api` default unless you separately implement and verify a production proxy; the deployment check deliberately requires an absolute HTTPS API URL. All `VITE_*` values are browser-visible. Never put database, AWS, Mailgun, or signing secrets there.

`npm run check:deploy` checks these public values without printing them. It does not certify legal readiness or connectivity. `npm run build` remains available for local tests and previews while production values are pending. The operator has approved the policy effective date; pending operational details remain separate deployment limitations. Registration acceptance is enforced by the API once the accompanying migration is applied.

For Cloudflare Pages, preserve its SPA fallback (do not introduce a top-level `404.html`). For Workers static assets, configure `assets.directory` as `./dist` and `assets.not_found_handling` as `single-page-application` after choosing that product. Both must serve deep links such as `/legal/privacy` and `/workspaces` through the app. `public/_headers` supplies baseline static-response headers; Workers code or Pages Functions responses need equivalent headers separately. Verify the headers on the real hostname; Vite preview does not apply this file. A complete CSP must be designed with the final API/storage origins; the current policy only restricts framing, base URLs, and embedded objects.

Configure backend CORS for the exact enabled frontend origins (for example `https://donee.dev`, and `https://www.donee.dev` only if actually served). Configure S3 CORS independently for direct browser uploads and the real frontend origin. Do not add blanket wildcard production origins. Verify API routing, preflight requests, sign-in/refresh/logout, recovery email, private task/file access, upload/download/deletion, and deep links against staging before opening public registration. Local browser tests use isolated storage and email adapters and do not verify production vendors.

Keep Cloudflare Web Analytics, Zaraz, advertising pixels, and optional third-party scripts disabled unless the disclosures and required controls are implemented. Check the deployed site for provider-injected scripts and storage. Keep current HTML revalidated and never cache authenticated API responses or signed file URLs in a service worker. No service worker is shipped here.

## Policy acceptance migration

Before running this version against a database, apply Alembic revision `63a9c72d8e10` (after `27429857847c`) using `alembic upgrade head` from the repository root with the intended database configuration. The migration creates `policy_acceptances`; it does not infer assent for old accounts. It has not been applied to the developer or production database by this change. Downgrading drops stored receipts. Account deletion cascades to its registration receipt; any future legal-hold or longer retention workflow must be explicitly designed before changing that behavior.

Publish the frontend and backend together. The frontend constants in `src/features/legal/versions.ts`, backend constants in `app/core/legal.py`, and published legal documents must agree. Increment versions only with the corresponding policy release. This stage records registration assent for the fresh launch; a future material-change/reacceptance workflow for existing users is separate work. The immutable Git release preserves the associated policy text.
