# TalentPilot Frontend

The web app for **TalentPilot**, a chat-first AI recruiting co-worker. A recruiter pastes a job description, and TalentPilot creates the job, finds and scores candidates, sends outreach, reads replies, books meetings and tracks every candidate to hire.

Every action can be done by asking the AI in the chat or by hand in the app. The AI never acts on its own: each action is a card the recruiter confirms first.

| Repository | Contents |
|---|---|
| [Talent-Pilot-Backend](https://github.com/samiremon/Talent-Pilot-Backend) | API, AI agent, background worker, **Docker setup**, sample data |
| **[Talent-Pilot-Frontend](https://github.com/samiremon/Talent-Pilot-Frontend)** (this one) | The web app (React) |

## Contents

1. [Quick start](#1-quick-start)
2. [Architecture](#2-architecture)
3. [How the agent and background jobs appear in the app](#3-how-the-agent-and-background-jobs-appear-in-the-app)
4. [LLM, agent approach, done / mocked / skipped, trade-offs](#4-llm-agent-approach-done--mocked--skipped-trade-offs)
5. [Context window optimization](#5-context-window-optimization)
6. [Development](#6-development)

---

## 1. Quick start

The whole project (this web app, the API, the database, the queue and an email inbox) starts with **one Docker command from the backend repository**.

### Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/), or Docker Engine with the Compose plugin
- [Git](https://git-scm.com/downloads)
- A free **Groq API key** (step 2)

### Step 1: Download both repositories

Clone them into the same folder:

```bash
git clone https://github.com/samiremon/Talent-Pilot-Backend.git
git clone https://github.com/samiremon/Talent-Pilot-Frontend.git
```

### Step 2: Get a Groq API key

1. Sign up or log in at **<https://console.groq.com>**.
2. Open **<https://console.groq.com/keys>** and click **Create API Key**.
3. Copy the key. It starts with `gsk_`.

> Without a key the app still runs, in **mock mode**: the AI gives fixed sample answers.

### Step 3: Create the settings file

```bash
cd Talent-Pilot-Backend
cp .env.example .env
```

In `.env`, set `GROQ_API_KEY`, `MONGO_PASSWORD`, `REDIS_PASSWORD`, `SEED_RECRUITER_EMAIL` and `SEED_RECRUITER_PASSWORD`.

### Step 4: Start

```bash
docker compose up --build -d
```

### Step 5: Open the app

| What | Address |
|---|---|
| **TalentPilot** | <http://localhost:8080> |
| Email inbox (Mailpit) | <http://localhost:8025> |

Log in with the email and password from `.env`.

Sample data (a Software Engineer job description and a 16-candidate CSV) and a step-by-step walkthrough from job description to hire are in the **[backend README](https://github.com/samiremon/Talent-Pilot-Backend#2-seed-data-try-the-full-flow)**.

---

## 2. Architecture

### Stack

| Part | Choice |
|---|---|
| UI | React 18 + TypeScript |
| Build | Vite |
| Routing | React Router (each page and tab has its own address) |
| Icons | lucide-react |
| Styling | Plain CSS with design tokens, light and dark mode |
| Production | Unprivileged nginx in Docker |

### Layout

```
┌───────────────────────────── top bar (notifications, account) ─────────────────────────────┐
│ sidebar          │             current page              │         AI chat panel          │
│ Dashboard        │                                       │   messages + action cards      │
│ Jobs             │                                       │   (Confirm / Cancel)           │
│ Calendar         │                                       │                                │
│ Outreach         │                                       │                                │
│ Activity         │                                       │                                │
└──────────────────┴───────────────────────────────────────┴────────────────────────────────┘
```

- **Chat panel:** it can be docked, expanded to full width or minimized, and the choice is remembered.
- **Phones:** the sidebar becomes a drawer and the chat opens full screen.

### Pages

| Address | Page |
|---|---|
| `/` | **Dashboard:** funnel, reply rate, interested rate, meetings and hires per job |
| `/jobs` | Jobs list, and a form to create a job |
| `/jobs/:id` | **Candidates:** score, reason, evidence, status, review and bulk actions |
| `/jobs/:id/pipeline` | **Pipeline:** a board with one column per status |
| `/jobs/:id/replies` | **Replies:** one conversation per candidate, AI-drafted answers, Simulate reply |
| `/jobs/:id/emails` | **Emails:** campaigns, drafts and send times |
| `/jobs/:id/activity` | Every change to the job, with undo |
| `/calendar` | **Calendar:** meeting hours, busy hours, booked calls |
| `/outreach` | All jobs in a table; click one to open its Emails and Replies |
| `/activity` | Activity log, token usage, AI limits |

### Data flow

```
component ─► useApi('/jobs/123') ─► api() ─► fetch('/api/jobs/123', login cookie) ─► backend
                ▲
                └── reloads on notifyDataChanged() after any change anywhere in the app
```

- **`api.ts`:** a single helper for all requests. It sends and reads JSON, includes the login cookie, and turns errors into readable messages.
- **`useApi.ts`:** loads data for a component and handles the loading, error and data states. After a change, every page on screen reloads, so the chat, tables and board stay in sync.
- **No state library:** each page loads its own data, and shared state lives in a few small hooks and contexts.
- **nginx:** forwards `/api` to the API container, so there is no CORS. It also sends security headers (CSP, X-Frame-Options and others).

### Folder layout

```
src/
├── App.tsx, main.tsx    routes and entry point
├── api.ts, useApi.ts    requests and data loading
├── useJobTasks.ts       live background-task progress
├── auth/                login state and account forms
├── layout/              top bar, sidebar, notification bell
├── chat/                AI chat panel and action cards
├── pages/               one file per page or tab
├── components/          shared dialogs (candidate details, timeline, email, …)
└── index.css            design tokens, light and dark themes
```

More detail: [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 3. How the agent and background jobs appear in the app

**The AI agent (chat panel):**

- **Sending:** you type a request, and the chat sends it to the backend together with the job you are looking at.
- **Read questions** ("who are the top 5?") are answered directly.
- **Changes** come back as **cards**: create a job, move candidates, start a campaign, send an email, answer a reply, find candidates, and more. A card shows exactly what will happen, can be edited where it makes sense, and does nothing until you press **Confirm**.
- **Same result by hand:** every card's action can also be done in the pages, and the backend runs the same code either way.

**Background jobs (live progress):**

- **Long tasks** (scoring, web search, drafting and sending emails, reading replies) run on the backend's queue.
- **Progress bars** ("Scored 15 of 23") update live over **Server-Sent Events**, through `useJobTasks.ts`. Each browser tab opens a single shared connection, which is closed while the tab is hidden, because browsers allow only about 6 connections per site.
- **Chat, notifications and the Calendar** refresh after every change, when the tab becomes visible again, and on a timer (20 s for the chat and notifications, 30 s for the Calendar).

---

## 4. LLM, agent approach, done / mocked / skipped, trade-offs

These are covered in the **backend README**, where the AI runs:

- [How the agent works](https://github.com/samiremon/Talent-Pilot-Backend#4-how-the-agent-works)
- [How the background jobs work](https://github.com/samiremon/Talent-Pilot-Backend#5-how-the-background-jobs-work)
- [Why this LLM and agent approach](https://github.com/samiremon/Talent-Pilot-Backend#6-why-this-llm-and-agent-approach): Groq with `gpt-oss-120b` for the chat and `gpt-oss-20b` for bulk work, one LangGraph agent with tools
- [Done, mocked and skipped](https://github.com/samiremon/Talent-Pilot-Backend#8-done-mocked-and-skipped)
- [Trade-offs](https://github.com/samiremon/Talent-Pilot-Backend#9-trade-offs)

**Frontend trade-offs:**

| Decision | Benefit | Cost |
|---|---|---|
| No state-management library | Less code, easy to follow | Pages refetch after a change, rather than updating a shared store |
| A single shared live connection | Never hits the browser's connection limit | Progress pauses while a tab is hidden (it catches up when you return) |
| Polling for chat and notifications | Simple and works behind any proxy | A new reply can take up to 20 s to appear when nothing else triggers a refresh |

---

## 5. Context window optimization

Groq's free plan allows **8,000 tokens a minute** for the chat model, so every message to the AI is kept as small as possible without losing what it needs. (The AI runs in the backend; this is how it is done there.)

**System prompt**

- Kept short on purpose, because it is sent with every call.
- Each rule is stated once.

**Workspace summary**

- The job on screen gets full detail; other jobs get one line each.
- Activity is cut to the latest 8 lines.
- The whole summary has a hard cap of about 3,000 characters, and the oldest lines are dropped first.

**Data on demand, not up front**

- Candidates aren't put in the prompt. The AI fetches them with tools, 10 at a time, one compact line each.
- Name searches return at most 5 matches.

**Chat history**

- Only the recent conversation is sent.
- Old long messages, such as a pasted job description, are shortened in the history.

**Skipping model calls where code is enough**

- Full lists (candidates, emails) go straight from the database to the recruiter, so they cost no output tokens and can't be invented.
- Confirmation messages are built by code.
- Web search queries are built from the job's fields without the AI.

**Batching**

- Candidates are scored 10 per call, so the job description is sent once per batch, not once per person.

**Small, fixed answer formats**

- Every AI task must return a fixed JSON shape, which keeps answers short.

**Budget check before each call**

- The app estimates the tokens needed and compares them with what Groq last reported as left.
- It waits briefly if that is enough, or tells the recruiter how long to wait.
- Every call's usage is shown on **Activity → Token usage**.

---

## 6. Development

Requires **Node.js 20 or newer**, and the backend running on `http://localhost:4000` (see the backend README, *Development and tests*).

```bash
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

The development server forwards `/api` to `VITE_PROXY_TARGET` (default `http://localhost:4000`).

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Check types and build for production |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Check types only |

| File | Purpose |
|---|---|
| `Dockerfile` | Builds the app and serves it with nginx on port 8080 |
| `nginx.conf` | Serves the app, forwards `/api` to the API, sends security headers |
| `.env.example` | Settings for the development server |
