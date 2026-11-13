/**
 * "What's left": the Activity → Remaining usage tab.
 *
 * Per Groq model (live, from Groq's own answers):
 *   - Requests left              e.g. 997 / 1,000 (99%)
 *   - Tokens left this minute    e.g. 7,923 / 8,000
 *   - Daily tokens               exactly what Groq last said: "Available" (Groq accepted a
 *                                call) or "Used up: 199,135 of 200,000 · frees up in 16 min"
 *                                (Groq's own refusal). Groq doesn't send a "tokens left today"
 *                                number, so we don't show one (no estimates).
 *   - Your AI calls in the last 24 h (from our own token log)
 * (Optional token budgets from .env are still available from the API, just not shown here.)
 *
 * Important: Groq's limits are REFILLING BUCKETS, not daily counters. 1,000 requests a day
 * means one used request comes back every 86.4 s, so "requests left" stays near 1,000 unless
 * many requests are made in a short time. That's why we also show the real 24 h usage.
 *   - Tokens left today          our own count vs the daily limit from .env (if set)
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
    dailyTokens: {
      status: 'available' | 'used_up' | 'unknown';
      lastOkAt: string | null;
      limit: number | null;
      used: number | null;
      refusedAt: string | null;
      freesAt: string | null;
    };
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

/** "in about 16 min" / "at 18:42" for when Groq said the daily limit frees up. */
function freesUpText(freesAt: string): string {
  const ms = new Date(freesAt).getTime() - Date.now();
  if (ms <= 0) return 'Groq said it would be free again by now: press Check now to confirm';
  const min = Math.ceil(ms / 60_000);
  return `Groq says it frees up in about ${min < 90 ? `${min} min` : `${Math.round(min / 60)} h`} (at ${new Date(freesAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
}

/** The daily token limit, exactly as Groq last reported it. */
function DailyTokens({ daily }: { daily: AiLimits['models'][number]['dailyTokens'] }) {
  const limitText = daily.limit ? `${daily.limit.toLocaleString()} tokens a day` : null;
  return (
    <div className="limit">
      <div className="limit__top">
        <span className="limit__label">Daily tokens</span>
        {daily.status === 'used_up' ? (
          <span className="limit__value limit__value--bad">
            <strong>Used up</strong>
            {daily.used !== null && daily.limit !== null && (
              <>
                {' '}
                · {daily.used.toLocaleString()} of {daily.limit.toLocaleString()} used
              </>
            )}
          </span>
        ) : daily.status === 'available' ? (
          <span className="limit__value limit__value--ok">
            <strong>Available</strong>
          </span>
        ) : (
          <span className="limit__value muted">No answer from Groq yet</span>
        )}
      </div>
      <span className="limit__note">
        {daily.status === 'used_up' && daily.freesAt
          ? `${freesUpText(daily.freesAt)}.`
          : daily.status === 'available' && daily.lastOkAt
            ? `Groq accepted a call ${timeAgo(daily.lastOkAt)}${limitText ? ` · limit ${limitText} (from Groq)` : ''}.`
            : 'Press Check now to ask Groq.'}{' '}
        Groq only reports this number when the limit is reached, so there's no "% left" here.
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
                <DailyTokens daily={m.dailyTokens} />
                {m.updatedAt && <span className="limit__note">Groq numbers from {timeAgo(m.updatedAt)}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
