# TalentPilot Frontend

The web app for **TalentPilot**, a chat-first AI recruiting co-worker.

This guide covers running the project. For how the app is built, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Run the whole project (recommended)

The full stack (this web app, the API, the database, the queue and the email inbox) starts with **one Docker command from the backend repository**.

Follow the step-by-step guide in **[Talent-Pilot-Backend → README](https://github.com/samiremon/Talent-Pilot-Backend#readme)**. In short:

```bash
# 1. Clone both repositories into the same folder
git clone https://github.com/samiremon/Talent-Pilot-Backend.git
git clone https://github.com/samiremon/Talent-Pilot-Frontend.git

# 2. Create the settings
cd Talent-Pilot-Backend
cp .env.example .env
#    Open .env and set GROQ_API_KEY, MONGO_PASSWORD, REDIS_PASSWORD
#    and your login (SEED_RECRUITER_EMAIL / SEED_RECRUITER_PASSWORD)

# 3. Start
docker compose up --build -d
```

Then open **<http://localhost:8080>** and log in.

### Groq API key

The AI runs on [Groq](https://groq.com). A free key is enough:

1. Sign up or log in at **<https://console.groq.com>**.
2. Open **<https://console.groq.com/keys>** and click **Create API Key**.
3. Copy the key (it starts with `gsk_`) into `GROQ_API_KEY` in the backend's `.env`.

Without a key the app still runs, but the AI gives fixed sample answers.

---

## Run the web app for development

Requires **Node.js 20 or newer**, and the backend running on `http://localhost:4000` (see the backend README, section *Run without Docker*).

```bash
cp .env.example .env
npm install
npm run dev
```

Open **<http://localhost:5173>**. The dev server forwards every `/api` request to the backend, so the browser talks to a single address.

| Setting (`.env`) | Default | What it does |
|---|---|---|
| `VITE_PROXY_TARGET` | `http://localhost:4000` | Where the dev server forwards `/api` requests |

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Check types and build for production (into `dist/`) |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Check types only |

## Files used to run the app

| File | Purpose |
|---|---|
| `Dockerfile` | Builds the app and serves it with an unprivileged nginx on port 8080 |
| `nginx.conf` | Serves the app, forwards `/api` to the API container, sends security headers |
| `.env.example` | Settings for the development server |

The Docker image is built and started by the backend's `docker-compose.yml`. It expects this repository to be cloned next to the backend one, or `FRONTEND_DIR` to be set in the backend's `.env`.
