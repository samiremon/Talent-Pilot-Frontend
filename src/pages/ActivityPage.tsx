/**
 * Activity (sidebar), three tabs, each with its own address:
 *
 *   /activity                    Activity: everything that happened, with WHO did it
 *   /activity/token-usage        Token usage: every AI call, who, what task, tokens
 *   /activity/token-dashboard    Token dashboard: tokens per recruiter, all time and
 *                                for the last N days (you choose N)
 *
 * Long lists load 50 rows at a time with a "Load more" button.
 */
import { BarChart3, Coins, History } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { api, ApiError } from '../api';
import { ActivityList, ActorTag, LoadState } from '../components/DataParts';
import { EmptyState, PageHeader } from '../components/PageParts';
import { timeAgo, tokens } from '../format';
import type { ActivityItem, Page, TokenDashboard, TokenTotals, TokenUsageItem } from '../types';
import { useApi } from '../useApi';
import { AiLimitsCard } from './AiLimitsCard';

const TABS = [
  { to: '', label: 'Activity', icon: History },
  { to: 'token-usage', label: 'Token usage', icon: Coins },
  { to: 'token-dashboard', label: 'Token dashboard', icon: BarChart3 },
];

export function ActivityPage() {
  return (
    <>
      <PageHeader title="Activity" subtitle="What happened, who did it, and how many AI tokens it used." />
      <nav className="tabs" aria-label="Activity sections">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={label} to={to} end={to === ''} className="tab tab--icon">
            <Icon size={15} aria-hidden="true" /> {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}

/**
 * Loads a long list page by page: first 50, then "Load more" asks for the 50 before the
 * last row we have. `reset` starts over (e.g. after something changed).
 */
function usePagedList<T extends { id: string }>(path: string) {
  const [items, setItems] = useState<T[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (before: string | null) => {
      setLoading(true);
      try {
        const query = before ? `?before=${encodeURIComponent(before)}` : '';
        const page = await api<Page<T>>(`${path}${query}`);
        // Append when loading more; replace on the first page.
        setItems((current) => (before ? [...current, ...page.items] : page.items));
        setNext(page.nextBefore);
        setError(null);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not load this list.');
      } finally {
        setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  return { items, loading, error, hasMore: next !== null, loadMore: () => void load(next) };
}

function LoadMore({ hasMore, loading, onClick }: { hasMore: boolean; loading: boolean; onClick: () => void }) {
  if (!hasMore) return null;
  return (
    <div className="load-more">
      <button type="button" className="button button--ghost" onClick={onClick} disabled={loading}>
        {loading ? 'Loading…' : 'Load more'}
      </button>
    </div>
  );
}

// ---------- Tab 1: Activity ----------

export function ActivityTab() {
  const list = usePagedList<ActivityItem>('/activity');
  return (
    <div className="card panel">
      <LoadState loading={list.loading && list.items.length === 0} error={list.error} />
      {!(list.loading && list.items.length === 0) && <ActivityList items={list.items} showJob />}
      <LoadMore hasMore={list.hasMore} loading={list.loading} onClick={list.loadMore} />
    </div>
  );
}

// ---------- Tab 2: Token usage ----------

export function TokenUsageTab() {
  const list = usePagedList<TokenUsageItem>('/activity/token-usage');

  if (!list.loading && !list.error && list.items.length === 0) {
    return (
      <div className="card">
        <EmptyState icon={Coins} title="No AI calls yet">
          Every time the AI reads a job description, answers in the chat or scores candidates, it shows up here with the
          tokens it used.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="card table-wrap">
      <LoadState loading={list.loading && list.items.length === 0} error={list.error} />
      {list.items.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Who</th>
              <th scope="col">Task</th>
              <th scope="col">Job</th>
              <th scope="col">Model</th>
              <th scope="col" className="num">
                In
              </th>
              <th scope="col" className="num">
                Out
              </th>
              <th scope="col" className="num">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((row) => (
              <tr key={row.id}>
                <td className="muted" title={new Date(row.createdAt).toLocaleString()}>
                  {timeAgo(row.createdAt)}
                </td>
                <td>
                  <ActorTag actor={row.userId ? 'recruiter' : 'system'} name={row.userName} />
                </td>
                <td>{row.taskLabel}</td>
                <td>{row.jobId ? <Link to={`/jobs/${row.jobId}`}>{row.jobTitle}</Link> : <span className="muted">No job</span>}</td>
                <td className="muted small">{row.model}</td>
                <td className="num">{row.inputTokens.toLocaleString()}</td>
                <td className="num">{row.outputTokens.toLocaleString()}</td>
                <td className="num strong">{(row.inputTokens + row.outputTokens).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <LoadMore hasMore={list.hasMore} loading={list.loading} onClick={list.loadMore} />
    </div>
  );
}

// ---------- Tab 3: Token dashboard ----------

const QUICK_DAYS = [1, 7, 30, 90];
const total = (t: TokenTotals) => t.inputTokens + t.outputTokens;

export function TokenDashboardTab() {
  // `days` is what's shown in the box; `applied` is what we actually asked the server for.
  // We wait half a second after typing stops, so typing "30" doesn't ask for "3" first.
  const [days, setDays] = useState('7');
  const [applied, setApplied] = useState(7);
  const valid = /^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 365;

  useEffect(() => {
    if (!valid) return;
    const timer = window.setTimeout(() => setApplied(Number(days)), 500);
    return () => window.clearTimeout(timer);
  }, [days, valid]);

  const { data, error, loading } = useApi<TokenDashboard>(`/activity/token-dashboard?days=${applied}`);
  const periodLabel = applied === 1 ? 'last 24 hours' : `last ${applied} days`;
  const biggest = data ? Math.max(1, ...data.users.map((u) => total(u.lastDays))) : 1;

  return (
    <>
      {/* How much of the Groq limits (and your own budgets) is left. */}
      <AiLimitsCard />

      <div className="card panel days-picker">
        <label htmlFor="days-input">Show tokens used in the last</label>
        <input
          id="days-input"
          type="number"
          min={1}
          max={365}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          aria-invalid={!valid}
          aria-describedby="days-hint"
        />
        <span>days</span>
        <div className="days-picker__quick" role="group" aria-label="Quick choices">
          {QUICK_DAYS.map((n) => (
            <button
              key={n}
              type="button"
              className={`chip ${applied === n && days === String(n) ? 'chip--active' : ''}`}
              onClick={() => {
                setDays(String(n));
                setApplied(n);
              }}
            >
              {n === 1 ? '24 hours' : `${n} days`}
            </button>
          ))}
        </div>
        <span id="days-hint" className={valid ? 'form-hint' : 'form-hint form-hint--error'}>
          {valid ? 'Any number from 1 to 365.' : 'Enter a whole number from 1 to 365.'}
        </span>
      </div>

      <LoadState loading={loading && !data} error={error} />

      {data && (
        <>
          <section className="kpis kpis--3" aria-label="Token totals">
            <div className="card kpi">
              <div className="kpi__label">Tokens, {periodLabel}</div>
              <div className="kpi__value">{tokens(total(data.totals.lastDays))}</div>
              <div className="kpi__note">
                {data.totals.lastDays.inputTokens.toLocaleString()} in · {data.totals.lastDays.outputTokens.toLocaleString()} out
              </div>
            </div>
            <div className="card kpi">
              <div className="kpi__label">AI calls, {periodLabel}</div>
              <div className="kpi__value">{data.totals.lastDays.calls.toLocaleString()}</div>
              <div className="kpi__note">Chat replies, job reading, scoring…</div>
            </div>
            <div className="card kpi">
              <div className="kpi__label">Tokens, all time</div>
              <div className="kpi__value">{tokens(total(data.totals.allTime))}</div>
              <div className="kpi__note">{data.totals.allTime.calls.toLocaleString()} AI calls</div>
            </div>
          </section>

          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Recruiter</th>
                  <th scope="col">Share, {periodLabel}</th>
                  <th scope="col" className="num">
                    Tokens, {periodLabel}
                  </th>
                  <th scope="col" className="num">
                    Calls
                  </th>
                  <th scope="col" className="num">
                    Tokens, all time
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.userId}>
                    <td>
                      <div className="table__title">{u.name}</div>
                      {u.email && <div className="muted small">{u.email}</div>}
                    </td>
                    <td className="share-cell">
                      {/* Bar length compared with the biggest user in this period. */}
                      <span className="share-bar" aria-hidden="true">
                        <span style={{ width: `${(total(u.lastDays) / biggest) * 100}%` }} />
                      </span>
                    </td>
                    <td className="num strong" title={`${u.lastDays.inputTokens.toLocaleString()} in · ${u.lastDays.outputTokens.toLocaleString()} out`}>
                      {total(u.lastDays).toLocaleString()}
                    </td>
                    <td className="num">{u.lastDays.calls.toLocaleString()}</td>
                    <td className="num" title={`${u.allTime.inputTokens.toLocaleString()} in · ${u.allTime.outputTokens.toLocaleString()} out`}>
                      {total(u.allTime).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
