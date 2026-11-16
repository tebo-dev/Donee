<div align="center">
  <img src="frontend/public/favicon.svg" width="80" height="80" alt="Donee's pixel computer" />
  <h1>Donee</h1>
  <p><strong>A quiet task manager with a terminal soul.</strong></p>
  <p>Workspaces for your work. Shortcuts for your flow.</p>
  <p><a href="https://app.donee.dev"><strong>Open Donee ↗</strong></a> · <a href="#what-you-can-do">Explore v1</a> · <a href="https://buymeacoffee.com/tebo.dev">Buy me a coffee ☕</a></p>
</div>

---

Donee is a personal task manager for keeping track of what you’re doing, what’s due, and what’s finished. Use it to plan a side project, organize coursework, or keep errands separate from work. Give each area its own workspace and keep the links and files you need on the task itself.

## What you can do

- **Give each area of your life its own space.** Create workspaces for things like a semester, a launch, or home admin.
- **See what needs attention.** Add due dates, priorities, and tags, then search and filter by status, tag, or date. Sort by due date to see what’s next.
- **Keep context close.** Attach a reference link, sketch, PDF, or text file to the task it belongs to.
- **Follow work through.** Mark a task in progress or blocked, complete it, reopen it, or archive it for later reference.
- **Make it feel like yours.** Pick Matrix, Terminal, Dracula, or Akira. Choose IBM Plex Mono or Fira Code for the small details.

**v1 is live and built for individual use.** Shared workspaces and team collaboration are outside this release.

## A few keystrokes go a long way

On a workspace’s task board:

| Key | Action |
| --- | --- |
| `j` / `k` or arrow keys | Move through the task list |
| `l` or `Enter` | Open the selected task |
| `x` | Complete or reopen the selected task |
| `a` | Add a task |
| `/` | Focus search |
| `?` | Show shortcuts |

## Under the hood

| Layer | Built with |
| --- | --- |
| Web app | React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, and Zod |
| Interface | Custom CSS, Phosphor Icons, and locally bundled fonts |
| API | Python, FastAPI, Pydantic, and Uvicorn |
| Data | PostgreSQL on Neon, SQLAlchemy, and Alembic migrations |
| Accounts | Argon2 password hashing, JWT access tokens, rotating refresh tokens, and Mailgun recovery email |
| Attachments | Private Amazon S3 storage with short-lived signed upload and download links |
| Hosting | Cloudflare Pages for the frontend; Railway for the API |
| Tests | pytest, Vitest, Testing Library, Playwright, and axe |

The browser talks to the FastAPI service for tasks, accounts, and workspace data. FastAPI checks access and signs attachment links; file bytes travel directly between the browser and S3.

## Work on Donee

Use Python 3.14.2, Node.js 24, and PostgreSQL. Create a Python virtual environment and install `requirements.txt`. Configure the backend from [the environment example](.env.example) with a dedicated development database and test provider settings.

From the repository root, with the virtual environment active and the development database configured:

```sh
python -m pip install -r requirements.txt
python -m alembic upgrade head
python -m uvicorn app.main:app --reload
```

In a second terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open [the local app](http://127.0.0.1:5173). Vite proxies API requests to port 8000 by default. See the [frontend guide](frontend/README.md) for local configuration and test commands, and the [deployment guide](DEPLOYMENT.md) for hosting, database migrations, and provider setup.

---

Built by [Esteban](https://github.com/tebo-dev). If Donee helps you get something done and you’d like to support the project, [you can buy me a coffee](https://buymeacoffee.com/tebo.dev). Thanks for giving it a try!
