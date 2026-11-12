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

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | Check types |
