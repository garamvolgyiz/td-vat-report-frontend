import { AdminShell } from "./components/AdminShell";
import { ReportPage } from "./features/report/ReportPage";

export function App() {
  return (
    <AdminShell>
      <ReportPage />
    </AdminShell>
  );
}
