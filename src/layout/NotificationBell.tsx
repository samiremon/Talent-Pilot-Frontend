/**
 * The bell in the top bar: "Priya Das replied: Wants a meeting · response waiting for you".
 *
 *   🔔 (2)  -> a list of the latest notifications (unread ones highlighted)
 *              click one -> it's marked read and you land on that candidate's conversation
 *              on the job's Replies tab;  "Mark all read" clears the count.
 *
 * From GET /api/notifications (made when a candidate replies or books a call, for the
 * recruiter who emailed them). Refreshed every 20 s, when you come back to the tab, and
 * whenever something changes in the app (e.g. a reply was just processed).
 */
import { Bell, CalendarCheck, MessageSquareReply } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { timeAgo } from '../format';

interface Notification {
  id: string;
  type: 'reply' | 'meeting';
  text: string;
  jobId: string;
  jobCode: string | null;
  jobTitle: string | null;
  candidateId: string;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [data, setData] = useState<{ unread: number; notifications: Notification[] }>({ unread: 0, notifications: [] });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  async function load() {
    if (document.visibilityState === 'hidden') return;
    try {
      setData(await api<{ unread: number; notifications: Notification[] }>('/notifications'));
    } catch {
      // offline for a moment: keep what we have
    }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(load, 20_000);
    window.addEventListener('talentpilot:data-changed', load);
    document.addEventListener('visibilitychange', load);
    return () => {
      clearInterval(timer);
      window.removeEventListener('talentpilot:data-changed', load);
      document.removeEventListener('visibilitychange', load);
    };
  }, []);

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  async function openOne(n: Notification) {
    setOpen(false);
    if (!n.read) {
      setData((d) => ({ unread: Math.max(0, d.unread - 1), notifications: d.notifications.map((x) => (x.id === n.id ? { ...x, read: true } : x)) }));
      void api(`/notifications/${n.id}/read`, { method: 'POST', body: {} }).catch(() => undefined);
    }
    navigate(`/jobs/${n.jobId}/replies?candidate=${n.candidateId}`);
  }

  async function readAll() {
    setData((d) => ({ unread: 0, notifications: d.notifications.map((x) => ({ ...x, read: true })) }));
    await api('/notifications/read-all', { method: 'POST', body: {} }).catch(() => undefined);
  }

  return (
    <div className="bell" ref={ref}>
      <button
        type="button"
        className="topbar-button bell__button"
        onClick={() => {
          setOpen((o) => !o);
          void load();
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={data.unread ? `Notifications: ${data.unread} unread` : 'Notifications'}
        title="Notifications"
      >
        <Bell size={18} aria-hidden="true" />
        {data.unread > 0 && <span className="bell__badge">{data.unread > 99 ? '99+' : data.unread}</span>}
      </button>
      {open && (
        <div className="bell__menu" role="menu">
          <div className="bell__head">
            <strong>Notifications</strong>
            {data.unread > 0 && (
              <button type="button" className="link-button" onClick={readAll}>
                Mark all read
              </button>
            )}
          </div>
          {data.notifications.length === 0 ? (
            <p className="bell__empty">Nothing yet. When a candidate replies, you'll see it here.</p>
          ) : (
            <ul className="bell__list">
              {data.notifications.map((n) => (
                <li key={n.id}>
                  <button type="button" role="menuitem" className={`bell__item${n.read ? '' : ' bell__item--unread'}`} onClick={() => openOne(n)}>
                    <span className="bell__icon" aria-hidden="true">
                      {n.type === 'meeting' ? <CalendarCheck size={16} /> : <MessageSquareReply size={16} />}
                    </span>
                    <span className="bell__text">
                      <span>{n.text}</span>
                      <span className="bell__meta">
                        {n.jobCode} {n.jobTitle} · {timeAgo(n.createdAt)}
                      </span>
                    </span>
                    {!n.read && <span className="bell__dot" aria-label="unread" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
