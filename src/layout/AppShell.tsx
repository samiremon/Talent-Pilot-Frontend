/**
 * The frame around every page once you're logged in:
 *
 *   ┌──────────────── top bar ────────────────┐
 *   │ sidebar │   current page   │  AI chat   │
 *   └─────────┴──────────────────┴────────────┘
 *
 * The current page is rendered where <Outlet /> is (react-router fills it in).
 * The chat can be docked, expanded to full width, or minimized to a bot button.
 */
import { Bot } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ChatPanel } from '../chat/ChatPanel';
import { useChatPanel } from '../chat/useChatPanel';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import './layout.css';

/** A short name for the page the recruiter is on, shown in the chat header. */
function describePage(pathname: string): string {
  if (pathname.startsWith('/jobs/')) return 'A job';
  if (pathname.startsWith('/jobs')) return 'Jobs';
  if (pathname.startsWith('/candidates')) return 'Candidates';
  if (pathname.startsWith('/outreach')) return 'Outreach';
  return 'Dashboard';
}

export function AppShell() {
  const chat = useChatPanel();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Red dot on the bot button: the AI said something while the chat was minimized.
  const [unread, setUnread] = useState(false);
  const { pathname } = useLocation();

  // The AI replies a moment after you send, so read the CURRENT mode via a ref
  // (a plain variable would be the value from when the message was sent).
  const modeRef = useRef(chat.mode);
  modeRef.current = chat.mode;

  // Opening the chat means you've seen the new messages.
  useEffect(() => {
    if (chat.mode !== 'minimized') setUnread(false);
  }, [chat.mode]);

  return (
    <div className="app">
      <TopBar sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((open) => !open)} />

      <div className={`shell ${chat.mode === 'expanded' ? 'shell--chat-expanded' : ''}`}>
        <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
        {/* Phones: dim the page behind the open drawer; tap to close it. */}
        <div
          className={`backdrop ${sidebarOpen ? 'backdrop--visible' : ''}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />

        <main className="main" id="main">
          <Outlet />
        </main>

        <ChatPanel
          mode={chat.mode}
          onMinimize={chat.minimize}
          onToggleExpanded={chat.toggleExpanded}
          onAiMessage={() => {
            if (modeRef.current === 'minimized') setUnread(true);
          }}
          context={describePage(pathname)}
        />
      </div>

      {chat.mode === 'minimized' && (
        <button type="button" className="chat-fab" onClick={chat.open} aria-label="Open TalentPilot AI chat">
          <Bot size={26} aria-hidden="true" />
          {unread && <span className="chat-fab__dot" aria-label="New message" />}
        </button>
      )}
    </div>
  );
}
