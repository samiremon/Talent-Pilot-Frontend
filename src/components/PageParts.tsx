/**
 * Small building blocks reused by every page:
 *   <PageHeader>  page title + subtitle (+ optional buttons on the right)
 *   <EmptyState>  the friendly "nothing here yet" message with an icon
 */
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import '../pages/pages.css';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty__icon" aria-hidden="true">
        <Icon size={22} />
      </span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}
