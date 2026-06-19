import type { ReactNode } from "react";
import { BarChart3, FileUp } from "lucide-react";

type AdminShellProps = {
  children: ReactNode;
  currentPath?: string;
};

export function AdminShell({ children, currentPath = "/report" }: AdminShellProps) {
  const isUpload = currentPath === "/upload" || currentPath === "/";
  const isReport = currentPath === "/report";

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">VAT admin</div>
        <nav className="nav-list">
          <a className={`nav-link ${isUpload ? "active" : ""}`} href="/upload" aria-current={isUpload ? "page" : undefined}>
            <FileUp aria-hidden="true" size={18} />
            Upload
          </a>
          <a className={`nav-link ${isReport ? "active" : ""}`} href="/report" aria-current={isReport ? "page" : undefined}>
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
