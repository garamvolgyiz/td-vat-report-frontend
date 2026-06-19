# Admin UI Design Reference Template

## Purpose

Give React TypeScript implementers a shared admin UI reference for pages defined
under `frontend/docs/lld/pages`.

Use this file before building page components. Copy the relevant sections into a
page LLD when a page needs page-specific UX decisions.

## Product Context

- Product: VAT reporting admin frontend.
- Primary users: internal finance, accounting, or support users who import XML
  invoices, inspect validation errors, and generate VAT declaration reports.
- Usage mode: repeated task execution, data review, exception handling, and
  downloadable evidence.
- UX goal: reduce import/report mistakes, make backend validation results easy to
  act on, and keep sensitive tax data controlled.

## Design Principles

- Prefer compact, scan-friendly admin layouts over marketing-style pages.
- Make the current task and primary action obvious on every page.
- Keep filters, source data, results, and errors visually separated.
- Preserve backend messages and codes where support or audit needs them.
- Never hide a failure behind a generic toast when the user needs to recover.
- Design tables for real data: long names, tax numbers, empty values, and many
  rows.
- Treat loading, empty, error, partial success, stale data, and permission states
  as required screen states.

## App Shell

Recommended layout:

- Left sidebar navigation on desktop.
- Top header inside content area for page title and global status.
- Single-column content on mobile.
- Main content max width: `1200px` for forms plus tables.
- Page padding: `24px` desktop, `16px` tablet, `12px` mobile.

Navigation:

- `Upload`
- `Template XML`
- `VAT report`

Shell behavior:

- Active navigation item must be visible.
- Sidebar collapses to a top navigation or drawer below `768px`.
- Main landmark uses `<main>`.
- Page title uses one `<h1>`.
- Each major page block uses ordered headings (`h2`, `h3`).

## Visual System

Use a restrained admin palette with semantic colors:

```ts
type AdminUiTokens = {
  color: {
    surface: string;
    surfaceMuted: string;
    border: string;
    text: string;
    textMuted: string;
    primary: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
    focus: string;
  };
  radius: {
    control: "6px";
    panel: "8px";
  };
  spacing: {
    xs: "4px";
    sm: "8px";
    md: "12px";
    lg: "16px";
    xl: "24px";
    xxl: "32px";
  };
};
```

Do not make the UI depend on color alone. Pair semantic colors with labels,
icons, or text.

Recommended typography:

- Base font: system UI stack.
- Body: `14px` or `16px` depending on density.
- Page title: `24px`.
- Section heading: `18px`.
- Table text: `14px`.
- Letter spacing: `0`.

## Page Layout Pattern

Use this page structure for admin workflows:

```tsx
type AdminPageLayoutProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};
```

Screen order:

1. Page header with title, short description, and optional secondary actions.
2. Task panel for inputs or upload controls.
3. Inline validation or request error.
4. Result summary.
5. Detailed result table.
6. Secondary recovery actions.

Avoid nested cards. Use panels only for functional groups such as filters, upload
controls, summaries, tables, and alerts.

## Component Reference

### Buttons

Button hierarchy:

- Primary: one per task area, used for submit/generate/upload.
- Secondary: retry, clear, download, refresh.
- Destructive: cancel, remove file, discard result.
- Icon button: compact table or toolbar actions.

Required states:

- Default
- Hover
- Focus visible
- Disabled
- Busy

Implementation reference:

```tsx
type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type ButtonProps = {
  variant?: ButtonVariant;
  isBusy?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
};
```

Busy buttons keep their width stable and expose `aria-busy="true"`.

### Forms

Use visible labels for every input. Helper text appears below the control.
Validation errors appear below the related input and are also summarized in the
page error region when submission fails.

Input anatomy:

- Label
- Required marker when needed
- Control
- Helper text
- Field error

Recommended field type:

```ts
type FieldError = {
  field?: string;
  code: string;
  message: string;
};
```

Date rules:

- Use native `<input type="date">`.
- Store values as `yyyy-MM-dd`.
- Validate ranges before API calls.
- Do not transform dates into UTC for date-only report filters.

### Alerts

Use alerts for blocking, recoverable, and request-specific feedback.

Variants:

- Success: completed task.
- Warning: partial success, stale result, recoverable issue.
- Danger: failed task, invalid input, request failure.
- Info: neutral guidance or empty state.

Implementation reference:

```tsx
type AlertVariant = "success" | "warning" | "danger" | "info";

type AlertProps = {
  variant: AlertVariant;
  title: string;
  children?: React.ReactNode;
  correlationId?: string;
};
```

Use `role="alert"` for failures and `role="status"` for success or neutral
status updates.

### Summary Panels

Summary panels show outcome before details. Keep values short and aligned.

Recommended structure:

```tsx
type SummaryMetric = {
  label: string;
  value: string | number;
  tone?: "neutral" | "success" | "warning" | "danger";
};
```

Metric labels must be understandable without relying on surrounding prose.

### Tables

Tables are primary admin surfaces. Use semantic tables for report rows and import
errors.

Required table behavior:

- `caption` for screen reader context.
- Sticky header when a table can grow vertically.
- Empty state row when there is no data.
- Horizontal scroll on mobile instead of compressed unreadable columns.
- Numeric values right-aligned.
- IDs, codes, and paths use monospace style.
- Optional columns are hidden only when every row has no value.

Implementation reference:

```ts
type DataTableColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  align?: "start" | "end";
  isOptional?: boolean;
};
```

Sort behavior:

- Import error table sorts by invoice index, line index, then field.
- Report tables do not recalculate or resort VAT rows unless product defines a
  business order.

### File Dropzone

Dropzone must work with pointer and keyboard.

Required behavior:

- Visible label.
- Hidden file input remains associated with label or button.
- Drag state is visual and non-color-only.
- One file selected at a time.
- Multiple drop keeps first file and shows local warning.
- Upload controls disabled while request is pending.

Implementation reference:

```tsx
type XmlFileDropzoneProps = {
  selectedFile?: File;
  isDisabled?: boolean;
  error?: string;
  onFileSelected: (file: File) => void;
  onRejected: (reason: string) => void;
};
```

### Download Actions

PDF downloads must use the last submitted valid report filter, not unsaved form
edits.

Required behavior:

- Button disabled until a report result exists.
- Busy state during PDF request.
- PDF-specific failures do not remove the JSON report.
- If form values change after result load, mark result stale.
- When result is stale, keep the PDF action available only for the displayed
  report and label it as downloading the displayed result.

## Page Templates

### Upload Page

Page header:

- Title: `XML upload`
- Description: short task statement, for example `Import one XML file, then
  review the summary and validation errors.`

Main regions:

- Upload task panel
- Local validation alert
- Import summary panel
- Import errors table

Primary action:

- `Start upload`

Secondary actions:

- `Choose another file`
- `Clear result`
- `Retry`

Upload states:

```ts
type UploadUiState =
  | "idle"
  | "selected"
  | "validating"
  | "uploading"
  | "completed"
  | "completed_with_errors"
  | "failed";
```

Result hierarchy:

1. Status label: import completed, import completed with errors, or import
   failed.
2. Metrics: total invoices, created invoices, skipped invoices, failed invoices,
   created lines.
3. Error table with backend message and error code visible.
4. Correlation ID when request failed or support handoff is likely.

Upload acceptance criteria:

- User can select an `.xml` file using keyboard only.
- Non-XML selection shows local validation before request.
- Upload button is disabled without a valid file.
- Pending upload shows stable busy state and prevents duplicate submission.
- `completed_with_errors` uses warning tone, not failure tone.
- Backend error messages and codes remain visible.
- User can clear result and start a new upload.

### VAT Declaration Report Page

Page header:

- Title: `VAT declaration`
- Description: short task statement, for example `Select a seller and period,
  then generate a report or download a PDF.`

Main regions:

- Report filter panel
- Validation/request alert
- Report summary panel
- Inbound VAT table
- Outbound VAT table
- PDF action area

Primary action:

- `Generate report`

Secondary actions:

- `Download PDF`
- `Reset filters`
- `Reload sellers`

Filter layout:

- Desktop: seller select spans 2 columns, date inputs use 1 column each, submit
  action aligns to end.
- Mobile: all fields stack in source order.

Report states:

```ts
type ReportUiState =
  | "loading_sellers"
  | "seller_load_failed"
  | "ready"
  | "generating"
  | "loaded"
  | "stale"
  | "downloading_pdf"
  | "failed";
```

Result hierarchy:

1. Seller name and selected period.
2. Stale result warning when filters changed after generation.
3. Inbound table.
4. Outbound table.
5. PDF download state and error, if any.

Report acceptance criteria:

- Page loads sellers before report generation.
- No-seller state disables submit and explains recovery.
- Date range validation runs before request.
- Results use API totals without browser recalculation.
- PDF button uses last submitted valid filter.
- PDF failure keeps JSON report visible.
- Empty inbound or outbound arrays render table empty states.

## Responsive Behavior

Breakpoints:

- Mobile: `< 768px`
- Tablet: `768px - 1023px`
- Desktop: `>= 1024px`

Rules:

- Forms stack on mobile.
- Tables use horizontal overflow on mobile.
- Primary action remains near the related form, not only in page header.
- Long tax numbers, invoice numbers, XML paths, and backend messages wrap or
  truncate with full value available via accessible label/title.
- Avoid fixed heights for dynamic error text.

## Accessibility Checklist

Required before a page is complete:

- One `<h1>` per page.
- Landmarks: header/nav/main.
- Visible labels for all controls.
- Error messages associated with controls through `aria-describedby`.
- Focus visible on every interactive element.
- Keyboard access for file selection, submit, retry, clear, and download.
- Busy state announced through `aria-busy` or status region.
- Success and failure feedback announced through status/alert regions.
- Tables include `caption`, `thead`, and `tbody`.
- Color contrast meets WCAG AA.
- Touch targets are at least `44px` high on mobile.

## Privacy And Data Handling

Do not expose sensitive tax data unnecessarily.

UI rules:

- Never show raw XML content in the UI unless a later LLD explicitly adds an XML
  inspection feature.
- Do not log seller names, buyer names, addresses, tax numbers, invoice numbers,
  amounts, or XML paths in production console.
- Show support identifiers such as `errorCode`, `importBatchId`, and
  `correlationId` because they help recovery without exposing full payloads.
- Keep downloaded PDF filename predictable and non-sensitive unless backend
  provides a safe filename.

## Error Copy Pattern

Use short, direct copy:

```ts
type UiCopy = {
  title: string;
  message: string;
  actionLabel?: string;
};
```

Examples:

- File required: `Choose an XML file to upload.`
- Invalid extension: `Upload an XML file.`
- Network failure: `Could not connect to the API.`
- Server failure: `The request could not be processed. Try again later.`
- Stale report: `Filters changed. Generate a new report to update the result.`

## Implementation Notes For React TypeScript

Recommended folders:

```text
src/
  app/
    routes/
  components/
    admin/
    feedback/
    forms/
    tables/
  features/
    upload/
    report/
  lib/
    api/
    formatting/
    runtime-config/
```

Recommended shared components:

- `AdminPageLayout`
- `Button`
- `Alert`
- `Field`
- `DataTable`
- `SummaryMetrics`
- `PageSection`

Recommended utility modules:

- `formatMoneyHu`
- `formatDateRangeHu`
- `buildApiUrl`
- `parseApiError`
- `downloadBlob`
- `createCorrelationId`
- `createIdempotencyKey`

Use discriminated unions for async states. Keep API DTOs separate from UI view
models when display logic needs derived labels, tones, or hidden columns.

## Design QA Checklist

Before handoff, verify:

- All page states from each LLD have a visible screen state.
- Primary action remains clear after errors and partial success.
- Tables remain usable with long values and empty arrays.
- Form errors are local, announced, and recoverable.
- Busy states prevent duplicate submissions.
- Mobile layout preserves task order.
- No sensitive data appears in production logs.
- Component props are typed without `any`.
- Unit tests cover validation, request states, result rendering, and recovery.
