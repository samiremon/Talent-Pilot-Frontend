/**
 * Left navigation. On phones it's a drawer that slides in (see layout.css).
 * NavLink marks the link of the current page as "active" so it's highlighted.
 */
import { Briefcase, CalendarDays, History, LayoutDashboard, Mail, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/outreach', label: 'Outreach', icon: Mail },
  { to: '/activity', label: 'Activity', icon: History },
];

interface SidebarProps {
  open: boolean;
  /** Called after a link is clicked, so the phone drawer closes. */
  onNavigate: () => void;
}

export function Sidebar({ open, onNavigate }: SidebarProps) {
  return (
    <nav className={`sidebar ${open ? 'sidebar--open' : ''}`} aria-label="Main">
      <div className="sidebar__label">Workspace</div>
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        // `end` on "/" stops Dashboard from looking active on every page.
        <NavLink key={to} to={to} end={to === '/'} className="nav-link" onClick={onNavigate}>
          <Icon size={18} aria-hidden="true" />
          {label}
        </NavLink>
      ))}
      <div className="sidebar__footer">TalentPilot · AI recruiting co-worker</div>
    </nav>
  );
}
