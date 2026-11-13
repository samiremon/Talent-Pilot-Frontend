/**
 * "What's left": the Activity → Remaining usage tab.
 *
 * Per Groq model (live, from Groq's own answers):
 *   - Requests left              e.g. 997 / 1,000 (99%)
 *   - Tokens left this minute    e.g. 7,923 / 8,000
 *   - Your AI calls in the last 24 h (from our own token log)
 *
 * Important: Groq's limits are REFILLING BUCKETS, not daily counters. 1,000 requests a day
 * means one used request comes back every 86.4 s, so "requests left" stays near 1,000 unless
 * many requests are made in a short time. That's why we also show the real 24 h usage.
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
  /** Requests only: seconds until one used request comes back. */
  refillSeconds?: number | null;
}

interface AiLimits {
  mode: 'groq' | 'mock';
  models: {
    model: string;
    usedBy: string[];
    updatedAt: string | null;
    callsLast24h: number;
    requestsToday: Meter;
    tokensPerMinute: Meter;
    tokensToday: Meter & { used: number };
  }[];
  week: Meter & { used: number };
  month: Meter & { used: number };
}

const ROLE_NAMES: Record<string, string> = { agent: 'chat & writing', bulk: 'scoring & sorting', safety: 'safety checks' };

function LimitBar({ label, meter, unit, note, hint }: { label: string; meter: Meter; unit: string; note?: string; hint?: string }) {
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
      {hint && <span className="limit__note">{hint}</span>}
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
                <LimitBar
                  label="Requests left"
                  meter={m.requestsToday}
                  unit="requests"
                  note="Updates after this model's next AI call"
                  hint={
                    m.requestsToday.refillSeconds
                      ? `Groq's limit is ${m.requestsToday.limit?.toLocaleString()} a day as a refilling bucket: each used request comes back after ${m.requestsToday.refillSeconds} s.`
                      : undefined
                  }
                />
                <div className="limit__usage">
                  Your AI calls in the last 24 h: <strong>{m.callsLast24h.toLocaleString()}</strong>
                </div>
                <LimitBar
                  label="Tokens this minute"
                  meter={m.tokensPerMinute}
                  unit="tokens"
                  note="Updates after this model's next AI call"
                  hint="Refills over each minute."
                />
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
