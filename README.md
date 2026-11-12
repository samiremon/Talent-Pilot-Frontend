# TalentPilot Frontend

Web app for **TalentPilot**, a chat-first AI recruiting co-worker.
See [plan.md](plan.md) for the full project plan.

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

Open <http://localhost:5173>. The page shows whether the backend
([Talent-Pilot-Backend](https://github.com/samiremon/Talent-Pilot-Backend)) is online.

## Docker

The full stack (website + API + database) is started from the backend repo:
see [Talent-Pilot-Backend → Run everything with Docker](https://github.com/samiremon/Talent-Pilot-Backend#run-everything-with-docker-recommended).

The image builds the site and serves it with an unprivileged **nginx** that:
- forwards `/api/*` to the backend container (same origin, so no CORS issues),
- sends security headers (CSP, X-Frame-Options, and more),
- falls back to `index.html` for app routes and caches hashed assets.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | Check types |
