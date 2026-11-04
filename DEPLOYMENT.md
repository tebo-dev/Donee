# Deploy Donee

## Railway backend

Connect the GitHub repository to a Railway service. Keep the service root at
the repository root (`/`), not `app` or `frontend`. Railway reads `/railway.json`
automatically; if an existing service has a custom config path, set it to
`/railway.json`. Remove any obsolete dashboard command overrides and check the
deployment details to confirm the settings came from this file.

The configuration uses Railpack and the committed `.python-version` to install
Python 3.14.2 and `requirements.txt`. No Node build or frontend server is needed
in this service. It runs:

```sh
# Pre-deploy: once per deployment, before the new API starts
python -m alembic upgrade head

# Start: Railway supplies PORT and expands it in the shell
python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Do not use `--reload` in production. A failed migration stops the deployment.
The `/health` endpoint returns `200 {"status":"ok"}` without authentication.
This checks the API process, not database, email, or S3 availability; Railway
uses it during deployment, not for continuous monitoring.

Add the following variables in Railway's service settings. `.env.example` is a
reference, not production credentials. Do not upload local `.env` files.

| Variable | Production value |
| --- | --- |
| `ENVIRONMENT` | `production` (so email goes to the actual user) |
| `DATABASE_URL` | Neon pooled PostgreSQL connection string, including TLS parameters |
| `DATABASE_URL_UNPOOLED` | Neon direct connection string for Alembic; optional if `DATABASE_URL` is already direct |
| `CORS_ALLOWED_ORIGINS` | JSON array of exact enabled frontend origins, e.g. `["https://donee.dev"]`, without trailing slashes |
| `JWT_SECRET_KEY` | A private, randomly generated signing secret; keep stable across deploys |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Credentials with access to the attachment bucket |
| `AWS_REGION` | The bucket's actual region (currently `us-east-2`) |
| `AWS_S3_BUCKET_NAME` | The private attachment bucket name |
| `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM` | Verified Mailgun sending configuration; required for registration and recovery |
| `MAILGUN_REGION` | `us` or `eu`, matching the Mailgun domain |

Generate a signing secret locally with
`python -c "import secrets; print(secrets.token_urlsafe(48))"` and paste it into
Railway. Optional token settings are documented in `.env.example`.
`DEVELOPMENT_EMAIL` is for nonproduction only. `API_V1_PREFIX` does not mount
routes: the API currently serves `/auth`, `/workspaces`, etc. directly.

Generate a public Railway domain (or attach an API custom domain), then use its
HTTPS origin as the frontend's API base URL. Set variables before deploying;
required database, signing, and AWS settings are validated when Python imports
the application, including during Alembic execution.

## Neon database

Create/select the intended production database and role in Neon. Copy both
connection strings from the Connect dialog:

```text
DATABASE_URL=postgresql://ROLE:ENCODED_PASSWORD@ENDPOINT-pooler.REGION.aws.neon.tech/DB?sslmode=require&channel_binding=require
DATABASE_URL_UNPOOLED=postgresql://ROLE:ENCODED_PASSWORD@ENDPOINT.REGION.aws.neon.tech/DB?sslmode=require&channel_binding=require
```

Use the real strings Neon supplies, including their hostname and TLS query
parameters. Standard `postgresql://` and `postgresql+psycopg2://` URLs both use
the installed psycopg2 driver. Preserve URL encoding in credentials (for
example `%40` for `@`); Alembic handles these escapes. Give the migration role
permission to create and alter the schema.

Railway's pre-deploy step applies all revisions through `63a9c72d8e10`, including
the initial schema, authentication/session tables, task contract changes, and
registration policy receipts. It does not seed accounts or infer past assent.
Use a fresh database for launch. For an existing database, back it up and review
the migration history before deployment; do not stamp an unmigrated schema as
current. Migrations run while the previous deployment may still be serving, so
future schema changes must remain compatible with that version.

To inspect migration status manually, run `python -m alembic current` with the
intended environment. Never run production migrations from a local shell that
still points to a developer database.

## Cloudflare Pages frontend

Use a separate Pages project connected to this repository:

| Setting | Value |
| --- | --- |
| Root directory | `frontend` |
| Build command | `npm ci && npm run build:deploy` |
| Build output directory | `dist` |
| Node.js | `24` (also pinned in `frontend/.nvmrc`) |
| `VITE_API_BASE_URL` | Actual HTTPS backend origin, with no `/api` suffix |
| `VITE_LEGAL_CONTACT_EMAIL` | Monitored public contact address |

Set the public build variables for each enabled production/preview environment.
Vite bakes them into the bundle, so rebuild after changing them. The deployment
check rejects a relative `/api` URL: Vite's development proxy does not exist on
Pages. Never place backend secrets in Cloudflare `VITE_*` variables.

Pages supplies SPA routing when there is no top-level `404.html`; preserve that
behavior for deep links. The existing `frontend/public/_headers` is copied to
`dist` during the build. If you choose Workers instead of Pages, follow the
Workers static-assets instructions in `frontend/README.md`; these Pages build
settings are not a Workers configuration.

Add the actual Pages/custom frontend origin to backend CORS. Add any preview
origin explicitly only when it should access that API. Configure S3 bucket CORS
separately for browser POST uploads from the same frontend origins, and keep
the bucket private. The API signs uploads/downloads; Cloudflare does not proxy
them.

## Verify before opening registration

1. Confirm the Railway migration step succeeds and `/health` returns 200 over
   the public HTTPS domain.
2. Open `/login`, `/legal/privacy`, and `/workspaces` directly on Pages and reload
   them. Check static response headers on the actual hostname.
3. Confirm browser API requests reach Railway, with successful CORS preflights.
4. Register with policy acceptance, receive the real welcome email, sign
   in, refresh the session, sign out, and exercise password recovery.
5. Create/edit/delete a workspace and task; upload, download, and delete an
   attachment. Verify another account cannot access private resources.

Local tests use isolated databases and email/storage adapters. They do not
verify production Neon connectivity, Mailgun delivery, bucket permissions, DNS,
or provider-injected scripts. Cloudflare analytics and optional third-party
scripts should remain disabled as described in `frontend/README.md`.

## Platform references

- [Railway config as code](https://docs.railway.com/config-as-code/reference)
- [Railway start commands](https://docs.railway.com/deployments/start-command)
- [Railway pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command)
- [Railway health checks](https://docs.railway.com/deployments/healthchecks)
- [Railpack Python support](https://railpack.com/languages/python)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Cloudflare Pages builds](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Cloudflare Pages SPA routing](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering)
