import { AdminShell } from "./components/AdminShell";
import { ReportPage } from "./features/report/ReportPage";
import { UploadPage } from "./features/upload/UploadPage";

export function App() {
  const path = window.location.pathname;
  const page = path === "/upload" || path === "/" ? <UploadPage /> : <ReportPage />;

  return (
    <AdminShell currentPath={path}>{page}</AdminShell>
  );
}
