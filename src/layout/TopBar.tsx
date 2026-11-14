/**
 * The dark bar across the top: menu button (phones only), logo, and the account menu.
 */
import { ChevronDown, LogOut, Menu, Send, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NotificationBell } from './NotificationBell';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

interface TopBarProps {
  /** Opens/closes the sidebar drawer on phones. */
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

/** "Rina Recruiter" -> "RR" for the round avatar. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
}

export function TopBar({ onToggleSidebar, sidebarOpen }: TopBarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the account menu when clicking anywhere else or pressing Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar-button topbar__hamburger"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={sidebarOpen}
      >
        <Menu size={20} />
      </button>

      <Link to="/" className="topbar__brand">
        <span className="logo-tile" aria-hidden="true">
          <Send size={16} />
        </span>
        TalentPilot
      </Link>

      <NotificationBell />
      <div className="topbar__right" ref={menuRef}>
        <button
          type="button"
          className="topbar-button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span className="avatar" aria-hidden="true">
            {initials(user?.name ?? '?')}
          </span>
          <span className="topbar__account-name">{user?.name}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>

        {menuOpen && (
          <div className="account-menu" role="menu">
            <div className="account-menu__who">
              {user?.name}
              <small>{user?.email}</small>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                navigate('/profile');
              }}
            >
              <UserRound size={14} aria-hidden="true" /> Profile
            </button>
            <button type="button" role="menuitem" onClick={() => void logout()}>
              <LogOut size={14} aria-hidden="true" /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
