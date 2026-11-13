/**
 * "What's left" card at the top of Activity → Token dashboard.
 *
 * Per Groq model (live, from Groq's own answers):
 *   - Requests left today        e.g. 992 / 1,000  (99%)  resets in 11 min
 *   - Tokens left this minute    e.g. 7,923 / 8,000
 *   - Tokens left today          our own count vs the daily limit from .env (if set)
 * Across all models:
 *   - This week / this month     usage, and % left of your own budget (if set in .env).
 *     Groq's free tier has no weekly or monthly limit, so without a budget we just say so.
 *
 * Bars are green above 50% left, amber from 20%, red below 20%.
 * "Check now" refreshes Groq's numbers with one tiny request per model.
 */
import { Gauge, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { api, ApiError } from '../api';
import { LoadState } from '../components/DataParts';
import { timeAgo } from '../format';
import { useApi } from '../useApi';

interface Meter {
  used?: number;
  limit: number | null;
  remaining: number | null;
  percentLeft: number | null;
  resetsAt?: string | null;
}

interface AiLimits {
  mode: 'groq' | 'mock';
  models: {
    model: string;
    usedBy: string[];
    updatedAt: string | null;
    requestsToday: Meter;
    tokensPerMinute: Meter;
    tokensToday: Meter & { used: number };
  }[];
  week: Meter & { used: number };
  month: Meter & { used: number };
}

const ROLE_NAMES: Record<string, string> = { agent: 'chat & writing', bulk: 'scoring & sorting', safety: 'safety checks' };

/** "in 11 min" / "in 40 s" / "now" */
function resetsIn(iso: string | null | undefined): string {
  if (!iso) return '';
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  if (seconds <= 0) return 'refilled';
  if (seconds < 90) return `resets in ${seconds} s`;
  if (seconds < 90 * 60) return `resets in ${Math.round(seconds / 60)} min`;
  return `resets in ${Math.round(seconds / 3600)} h`;
}

function LimitBar({ label, meter, unit, note }: { label: string; meter: Meter; unit: string; note?: string }) {
  if (meter.percentLeft === null || meter.limit === null || meter.remaining === null) {
    return (
      <div className="limit">
        <div className="limit__top">
          <span className="limit__label">{label}</span>
          <span className="limit__value muted">{note ?? 'No data yet'}</span>
        </div>
      </div>
    );
  }
  const level = meter.percentLeft > 50 ? 'ok' : meter.percentLeft >= 20 ? 'warn' : 'bad';
  return (
    <div className="limit">
      <div className="limit__top">
        <span className="limit__label">{label}</span>
        <span className="limit__value">
          <strong>{meter.percentLeft}% left</strong> · {meter.remaining.toLocaleString()} of {meter.limit.toLocaleString()} {unit}
        </span>
      </div>
      <div
        className="limit__track"
        role="progressbar"
        aria-label={`${label}: ${meter.percentLeft}% left`}
        aria-valuenow={meter.percentLeft}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className={`limit__fill limit__fill--${level}`} style={{ width: `${meter.percentLeft}%` }} />
      </div>
      {meter.resetsAt && <span className="limit__note">{resetsIn(meter.resetsAt)}</span>}
    </div>
  );
}

/** Week/month: % left of your own budget, or just the usage when no budget is set. */
function BudgetRow({ label, meter, envName }: { label: string; meter: Meter & { used: number }; envName: string }) {
  if (meter.limit !== null) return <LimitBar label={label} meter={meter} unit="tokens" />;
  return (
    <div className="limit">
      <div className="limit__top">
        <span className="limit__label">{label}</span>
        <span className="limit__value">{meter.used.toLocaleString()} tokens used</span>
      </div>
      <span className="limit__note">
        Groq's free tier has no {label.toLowerCase().includes('week') ? 'weekly' : 'monthly'} limit. Set {envName} in .env for a
        budget.
      </span>
    </div>
  );
}

export function AiLimitsCard() {
  const { data, error, loading } = useApi<AiLimits>('/activity/ai-limits');
  const [fresh, setFresh] = useState<AiLimits | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const limits = fresh ?? data;

  async function checkNow() {
    setChecking(true);
    setCheckError(null);
    try {
      setFresh(await api<AiLimits>('/activity/ai-limits/check', { method: 'POST' }));
    } catch (err) {
      setCheckError(err instanceof ApiError ? err.message : 'Could not check right now.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="card panel limits-card" aria-labelledby="limits-title">
      <header className="limits-card__header">
        <h2 className="panel__title" id="limits-title">
          <Gauge size={16} aria-hidden="true" /> AI limits left
        </h2>
        {limits?.mode === 'groq' && (
          <button type="button" className="button button--ghost button--small" onClick={checkNow} disabled={checking}>
            <RefreshCw size={14} aria-hidden="true" /> {checking ? 'Checking…' : 'Check now'}
          </button>
        )}
      </header>
      <LoadState loading={loading && !limits} error={error ?? checkError} />

      {limits?.mode === 'mock' && <p className="muted">Mock mode: no Groq key is set, so there are no limits to track.</p>}

      {limits?.mode === 'groq' && (
        <>
          <div className="limits-grid">
            {limits.models.map((m) => (
              <div key={m.model} className="limits-model">
                <div className="limits-model__name">
                  {m.model}
                  <span className="muted small"> · {m.usedBy.map((r) => ROLE_NAMES[r] ?? r).join(', ')}</span>
                </div>
                <LimitBar label="Requests today" meter={m.requestsToday} unit="requests" note="Updates after this model's next AI call" />
                <LimitBar label="Tokens this minute" meter={m.tokensPerMinute} unit="tokens" note="Updates after this model's next AI call" />
                <LimitBar
                  label="Tokens today"
                  meter={m.tokensToday}
                  unit="tokens"
                  note={`${m.tokensToday.used.toLocaleString()} used · set AI_DAILY_TOKEN_LIMIT in .env to see % left`}
                />
                {m.updatedAt && <span className="limit__note">Groq numbers from {timeAgo(m.updatedAt)}</span>}
              </div>
            ))}
          </div>
          <div className="limits-budgets">
            <BudgetRow label="This week (last 7 days)" meter={limits.week} envName="AI_TOKEN_BUDGET_WEEK" />
            <BudgetRow label="This month (last 30 days)" meter={limits.month} envName="AI_TOKEN_BUDGET_MONTH" />
          </div>
        </>
      )}
    </section>
  );
}
