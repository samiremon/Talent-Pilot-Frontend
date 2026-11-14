/**
 * Calendar: the team's meeting hours, one week at a time (Sunday to Thursday, 9 AM-6 PM,
 * Dhaka time, 1-hour slots).
 *
 *   Free    a candidate can book it from their booking link. Click it to mark it Busy.
 *   Busy    blocked by a recruiter ("I have something else then"): candidates don't see it.
 *           Click it to free it again.
 *   Booked  a candidate picked it. Click it to open their conversation.
 *   Past    too soon or already over (calls need 2 hours' notice).
 *
 * The AI reads the same calendar (show_calendar), so it can answer "what calls do I have?".
 * The page refreshes every 30 seconds, so a new booking shows up by itself.
 */
import { CalendarDays, ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { EmptyState, PageHeader } from '../components/PageParts';
import { notifyDataChanged, useApi } from '../useApi';
import './calendar.css';

interface MeetingInfo {
  id: string;
  start: string;
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobCode: string | null;
  jobTitle: string | null;
}

type Slot =
  | { start: string; state: 'free' | 'past' }
  | { start: string; state: 'busy'; busyId: string; blockedBy: string | null; note: string | null }
  | { start: string; state: 'booked'; meeting: MeetingInfo };

interface CalendarWeek {
  weekStart: string; // "2026-11-15", a Sunday
  days: { date: string; slots: Slot[] }[];
  upcoming: MeetingInfo[];
}

const TZ = 'Asia/Dhaka';
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const endOf = (iso: string) => timeOf(new Date(new Date(iso).getTime() + 3600_000).toISOString());
/** "2026-11-15" -> a Date at noon that day in Dhaka (safe for labels in any browser time zone). */
const dayDate = (key: string) => new Date(`${key}T12:00:00+06:00`);
const dayLabel = (key: string) => dayDate(key).toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
const whenLabel = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
/** Move a "YYYY-MM-DD" by whole days. */
const shiftDays = (key: string, days: number) => new Date(dayDate(key).getTime() + days * 86_400_000).toISOString().slice(0, 10);

export function CalendarPage() {
  const navigate = useNavigate();
  // null = this week; otherwise any date in the week to show.
  const [week, setWeek] = useState<string | null>(null);
  const { data, error, loading, reload } = useApi<CalendarWeek>(`/calendar${week ? `?week=${week}` : ''}`);
  const [busyKey, setBusyKey] = useState<string | null>(null); // the hour being saved
  const [actionError, setActionError] = useState<string | null>(null);

  // New bookings arrive from candidates: look again every 30 s while the tab is visible.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  /** Free -> Busy, or Busy -> Free. */
  async function toggle(slot: Slot) {
    setActionError(null);
    setBusyKey(slot.start);
    try {
      if (slot.state === 'free') await api('/calendar/busy', { method: 'POST', body: { start: slot.start } });
      else if (slot.state === 'busy') await api(`/calendar/busy/${slot.busyId}`, { method: 'DELETE' });
      notifyDataChanged(); // reloads this page too
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not change that hour. Please try again.');
      reload();
    } finally {
      setBusyKey(null);
    }
  }

  const openConversation = (m: MeetingInfo) => navigate(`/jobs/${m.jobId}/replies?candidate=${m.candidateId}`);

  const hours = data?.days[0]?.slots.map((s) => s.start) ?? [];
  const lastDay = data?.days[data.days.length - 1]?.date;
  const weekTitle = data && lastDay ? `${dayLabel(data.weekStart)} – ${dayLabel(lastDay)} ${dayDate(lastDay).getFullYear()}` : '';

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Meeting hours: Sunday to Thursday, 9 AM to 6 PM (Dhaka time). Candidates book a free hour from their link; mark hours Busy to block them."
      />

      <div className="card panel calendar">
        <div className="calendar__toolbar">
          <div className="calendar__nav">
            <button type="button" className="button button--ghost button--small" aria-label="Previous week" onClick={() => data && setWeek(shiftDays(data.weekStart, -7))}>
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button type="button" className="button button--ghost button--small" onClick={() => setWeek(null)} disabled={week === null}>
              This week
            </button>
            <button type="button" className="button button--ghost button--small" aria-label="Next week" onClick={() => data && setWeek(shiftDays(data.weekStart, 7))}>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <strong className="calendar__title">{weekTitle}</strong>
          </div>
          <ul className="calendar__legend" aria-label="Legend">
            <li><span className="swatch swatch--free" /> Free</li>
            <li><span className="swatch swatch--busy" /> Busy</li>
            <li><span className="swatch swatch--booked" /> Booked</li>
          </ul>
        </div>

        {actionError && (
          <p className="form-error" role="alert">
            {actionError}
          </p>
        )}
        {error && !data && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {loading && !data && <p className="muted">Loading…</p>}

        {data && (
          <div className="calendar__scroll">
            <table className="calendar__grid">
              <thead>
                <tr>
                  <th scope="col" className="calendar__corner">Time</th>
                  {data.days.map((d) => (
                    <th scope="col" key={d.date}>
                      {dayLabel(d.date)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hours.map((hour, row) => (
                  <tr key={hour}>
                    <th scope="row" className="calendar__hour">
                      {timeOf(hour)}–{endOf(hour)}
                    </th>
                    {data.days.map((d) => {
                      const slot = d.slots[row];
                      if (!slot) return <td key={d.date} />;
                      const saving = busyKey === slot.start;
                      const when = `${dayLabel(d.date)} ${timeOf(slot.start)}`;
                      return (
                        <td key={d.date}>
                          {slot.state === 'booked' ? (
                            <button type="button" className="slot slot--booked" onClick={() => openConversation(slot.meeting)} title={`Open the conversation with ${slot.meeting.candidateName}`}>
                              <span className="slot__name">{slot.meeting.candidateName}</span>
                              <span className="slot__meta">{slot.meeting.jobCode}</span>
                            </button>
                          ) : slot.state === 'busy' ? (
                            <button type="button" className="slot slot--busy" disabled={saving} onClick={() => toggle(slot)} aria-label={`${when}: busy. Click to free it`} title="Click to free this hour">
                              Busy
                              {slot.blockedBy && <span className="slot__meta">{slot.blockedBy}</span>}
                            </button>
                          ) : slot.state === 'free' ? (
                            <button type="button" className="slot slot--free" disabled={saving} onClick={() => toggle(slot)} aria-label={`${when}: free. Click to mark busy`} title="Click to mark this hour busy">
                              Free
                            </button>
                          ) : (
                            <span className="slot slot--past" aria-label={`${when}: past`}>
                              –
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card panel calendar-upcoming">
        <h2 className="panel__title">Upcoming calls</h2>
        {data && data.upcoming.length === 0 ? (
          <EmptyState icon={CalendarDays} title="No calls booked yet">
            When an interested candidate picks a time from their booking link, the call shows up here.
          </EmptyState>
        ) : (
          <ul className="calendar-upcoming__list">
            {data?.upcoming.map((m) => (
              <li key={m.id}>
                <button type="button" className="calendar-upcoming__item" onClick={() => openConversation(m)}>
                  <Video size={16} aria-hidden="true" />
                  <span className="calendar-upcoming__when">{whenLabel(m.start)}</span>
                  <span>
                    <strong>{m.candidateName}</strong>
                    <span className="muted">
                      {' '}
                      · {m.jobCode} {m.jobTitle}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
