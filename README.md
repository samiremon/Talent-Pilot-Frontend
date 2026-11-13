# TalentPilot Frontend

Web app for **TalentPilot**, a chat-first AI recruiting co-worker.

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

Open <http://localhost:5173> and sign in with the recruiter account from the backend's `.env`
(default `recruiter@example.com` / `change-me-recruiter`), or click **Use demo account** to fill them in.
The button only appears when the backend has `DEMO_LOGIN_ENABLED=true`.

The backend ([Talent-Pilot-Backend](https://github.com/samiremon/Talent-Pilot-Backend)) must be running.
The dev server forwards every `/api/*` request to it (`VITE_PROXY_TARGET`, default `http://localhost:4000`),
so the browser only ever talks to one address and the login cookie works without CORS setup.
The login page shows a small dot telling you whether the server and database are reachable.

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
