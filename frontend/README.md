# Donee frontend

Donee's React, TypeScript, and Vite frontend. Includes registration, sign-in, password recovery, and a protected account page. Appearance settings offer Matrix, Terminal, Dracula, and Akira themes, plus IBM Plex Mono and Fira Code for inputs and small details.

## Development

Use Node.js 24 (see `.nvmrc`) and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Keep the terminal running while using the site. Vite fails explicitly if that port is occupied.

Start the FastAPI backend separately with its database and mail provider configured. Copy `.env.example` to `.env.local` when local configuration is needed. `/api` requests are proxied to FastAPI at http://127.0.0.1:8000 during development. `API_PROXY_TARGET` changes that target. The API client reads `VITE_API_BASE_URL`. Never put secrets in `VITE_` variables.

Use `/login` or `/register` to get started. Password recovery begins at `/forgot-password` and uses the six-digit code delivered by the backend's email service. In development, the backend sends email to its configured development recipient. Recovery details stay in memory; keep the tab open until the reset is complete. `/account` requires a server-verified session.

The access token is stored in this tab's session storage and verified through `/auth/me` after a reload, on window focus, and periodically. It expires according to the backend's token lifetime. Sign-out clears this tab's token and cached data. The current backend provides no refresh-token or logout/revocation endpoint; password reset invalidates older tokens. No persistent “remember me” option is provided.

## Checks

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` runs formatting, linting, unit tests, TypeScript, and the production build. Browser tests serve the built frontend on port 4173 and run the existing FastAPI app on port 8011 with a temporary SQLite database and captured email delivery. A fixed `123456` code is used only inside that test process. They exercise real registration, sign-in, profile verification, password reset, and token invalidation, plus network-error feedback, keyboard behavior, narrow layouts, and automated accessibility. Mailgun delivery and production PostgreSQL behavior require separate environment verification.

Browser tests require the backend's Python dependencies. By default they use `../venv/Scripts/python.exe` on Windows or `../venv/bin/python` elsewhere. Set `DONEE_TEST_PYTHON` to use another Python interpreter. Both test ports must be free. The isolated API runner is test-only and is not part of the built frontend.

Use `npm run format` to format changes, `npm run test:watch` for unit tests, and `npm run test:e2e:ui` for browser debugging.

## Structure and tooling

- `src/app`: application routing and shared providers.
- `src/components`: appearance controls, brand, and pixel computer.
- `src/features/auth`: auth pages, form validation, session handling, and recovery flow.
- `src/lib`: API transport and error handling.
- `src/pages`: missing-route page.
- `src/styles`: theme tokens and global styles.
- `src/test` and `e2e`: component and browser test setup.
- React Router handles routes; TanStack Query is ready for server state.
- React Hook Form and Zod validate auth forms against the backend's contracts.
- Phosphor icons and locally bundled fonts support the approved design.

Production output is in `dist`. Configure the production host to serve `index.html` for application routes and route `/api` to the backend, or configure an API base URL at build time. The Vite development proxy is not a production API server.

The previous frontend remains recoverable from Git at commit `e6faefa`. The design-study prototype remains separate from this application; its mock authentication and task data are not production implementations.
