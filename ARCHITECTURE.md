# TalentPilot Frontend Architecture

How the web app is built. To run it, see [README.md](README.md). For the whole system (API, AI agent, background jobs, data model, design choices), see the **[backend ARCHITECTURE.md](https://github.com/samiremon/Talent-Pilot-Backend/blob/main/ARCHITECTURE.md)**.

---

## Stack

| Part | Choice |
|---|---|
| UI | React 18 + TypeScript |
| Build | Vite |
| Routing | React Router |
| Icons | lucide-react |
| Styling | Plain CSS with design tokens (CSS variables), light and dark mode |
| Production server | nginx (unprivileged), in Docker |

There is no state-management library. Each page loads its own data, and shared state is kept in a few small hooks and contexts.

## Layout

```
┌──────────────────────────── top bar (notifications, account) ────────────────────────────┐
│ sidebar          │            current page              │        AI chat panel         │
│ Dashboard        │                                      │   messages + action cards    │
│ Jobs             │                                      │   (Confirm / Cancel)         │
│ Calendar         │                                      │                              │
│ Outreach         │                                      │                              │
│ Activity         │                                      │                              │
└──────────────────┴──────────────────────────────────────┴──────────────────────────────┘
```

- The chat can be docked, expanded to full width, or minimized to a round button. The choice is remembered.
- On phones, the sidebar becomes a drawer and the chat opens full screen.

## Pages

| Address | Page |
|---|---|
| `/` | **Dashboard:** hiring funnel, reply rate, interested rate, meetings and hires, per job |
| `/jobs`, `/jobs/new` | Job list; create a job with a form |
| `/jobs/:id` | **Candidates:** score, reason, evidence, status, review and bulk actions |
| `/jobs/:id/pipeline` | **Pipeline:** a board with one column per status |
| `/jobs/:id/replies` | **Replies:** one conversation per candidate, the AI's drafted answers, Simulate reply |
| `/jobs/:id/emails` | **Emails:** campaigns, drafts, send times and countdowns |
| `/jobs/:id/activity` | Every change to the job, with undo |
| `/calendar` | **Calendar:** meeting hours, busy hours, booked calls |
| `/outreach` | Pick a job on the left; its Emails and Replies tabs on the right |
| `/activity` | Activity log, token usage, AI limits |
| `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password` | Accounts |

Each tab has its own address, so a refresh or a shared link opens the same view.

## Data flow

```
component ──► useApi('/jobs/123')  ──► api() ──► fetch('/api/jobs/123', cookie) ──► backend
                 ▲
                 └── reloads on notifyDataChanged()  (after any change anywhere in the app)
```

- **`api.ts`:** a single helper for every request. It sends and reads JSON, includes the login cookie, and turns backend errors into readable messages.
- **`useApi.ts`:** loads data for a component and handles the loading, error and data states. After a change, `notifyDataChanged()` makes every page on screen reload, so the chat, the tables and the board stay in sync.
- **`auth/AuthContext.tsx`:** who is logged in, plus login, sign-up and logout.

## Live updates

| What | How |
|---|---|
| Background task progress ("Scored 15 of 23") | **Server-Sent Events** via `useJobTasks.ts`: a single shared connection per browser tab (`/api/jobs/events`), closed while the tab is hidden |
| Chat messages and card states | Polled every 20 s, right after any change, and when the tab becomes visible |
| Notifications (bell) | Same as the chat |
| Calendar | Refreshed every 30 s |

A single shared event stream matters because browsers allow only about 6 open connections per site. One stream per progress bar would freeze the page.

## The AI chat

- **`chat/ChatPanel.tsx`:** the conversation, sending messages with the job on screen, attaching a CSV, and picking up new messages.
- **`chat/JobCard.tsx`, `chat/ActionCards.tsx`, `chat/ImportCsvCard.tsx`:** the cards the AI proposes (create job, change status, email campaign, send email, answer a reply, find candidates, and more). Each card shows exactly what will happen, is editable where it makes sense, and changes nothing until you press **Confirm**.
- Every action on a card can also be done by hand in the pages. The backend runs the same code for both.

## Folder layout

```
src/
├── main.tsx, App.tsx    entry point and routes
├── api.ts, useApi.ts    requests and data loading
├── useJobTasks.ts       live task progress (shared SSE stream)
├── auth/                login state and account forms
├── layout/              app frame: top bar, sidebar, notification bell
├── chat/                AI chat panel and action cards
├── pages/               one file per page or tab
├── components/          shared dialogs and parts (candidate details, timeline, email, ...)
├── pipeline.ts          status names and order (the backend enforces the rules)
├── ranking.ts           candidate ranks, same rules as the backend
├── types.ts             shared TypeScript types
└── index.css            design tokens, light and dark themes
```

## Production build

The `Dockerfile` builds the app with Vite and serves the files with an unprivileged nginx (`nginx.conf`), which:

- forwards `/api/*` to the API container, so the browser uses one address and needs no CORS setup;
- sends security headers (Content-Security-Policy, X-Frame-Options and others);
- serves `index.html` for app addresses and caches the hashed assets.
