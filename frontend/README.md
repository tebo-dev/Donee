# Donee frontend

React, TypeScript, and Vite foundation for the Phosphor design. Matrix is the default theme; Terminal, Dracula, and Akira tokens are also preserved. This stage contains the application shell and route fallback. Authentication and task workflows will be implemented and verified in later stages.

## Development

Use Node.js 24 (see `.nvmrc`) and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Keep the terminal running while using the site. Vite fails explicitly if that port is occupied.

Copy `.env.example` to `.env.local` when local configuration is needed. `/api` requests are proxied to FastAPI at http://127.0.0.1:8000 during development. `API_PROXY_TARGET` changes that target. Future API clients should read `VITE_API_BASE_URL`; no API calls are made by this foundation. Never put secrets in `VITE_` variables.

## Checks

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` runs formatting, linting, unit tests, TypeScript, and the production build. Browser tests build and serve the app on port 4173, checking route recovery, keyboard navigation, narrow layouts, runtime errors, and automated accessibility. These checks cover the shell, not future authentication or backend integration.

Use `npm run format` to format changes, `npm run test:watch` for unit tests, and `npm run test:e2e:ui` for browser debugging.

## Structure and tooling

- `src/app`: application routing and shared providers.
- `src/components`: brand and pixel ghost.
- `src/pages`: foundation and missing-route pages.
- `src/styles`: theme tokens and global styles.
- `src/test` and `e2e`: component and browser test setup.
- React Router handles routes; TanStack Query is ready for server state.
- React Hook Form, Zod, and their resolver are installed for the auth stage.
- Phosphor icons and locally bundled fonts support the approved design.

Production output is in `dist`. Configure the production host to serve `index.html` for application routes and route `/api` to the backend, or configure an API base URL at build time. The Vite development proxy is not a production API server.

The previous frontend remains recoverable from Git at commit `e6faefa`. The design-study prototype remains separate from this application; its mock authentication and task data are not production implementations.
