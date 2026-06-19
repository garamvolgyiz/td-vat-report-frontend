import type { ReactNode } from "react";
import { BarChart3, FileUp } from "lucide-react";

type AdminShellProps = {
  children: ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">VAT admin</div>
        <nav className="nav-list">
          <a className="nav-link" href="/upload">
            <FileUp aria-hidden="true" size={18} />
            Upload
          </a>
          <a className="nav-link active" href="/report" aria-current="page">
            <BarChart3 aria-hidden="true" size={18} />
            VAT report
          </a>
        </nav>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}

type AdminPageLayoutProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function AdminPageLayout({ title, description, actions, children }: AdminPageLayoutProps) {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}
