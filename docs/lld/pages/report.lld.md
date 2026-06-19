# VAT Declaration Report Page LLD

## Purpose

Define the React TypeScript `/report` page where a user selects a seller and date
range, generates a Hungarian VAT declaration report, views the JSON result, and
downloads the same report as PDF.

## Scope

In scope:

- Load sellers from `GET /api/v1/sellers`.
- Filter by one seller.
- Select inclusive `dateFrom` and `dateTo`.
- Default `dateFrom` to the first day of the current month.
- Default `dateTo` to the last day of the current month.
- Generate JSON report with `GET /api/v1/vat-declarations/report`.
- Display inbound and outbound VAT declaration rows.
- Download PDF with `GET /api/v1/vat-declarations/report/pdf` using the same
  filter.
- Show validation, not found, network, and server errors.

Out of scope:

- Editing sellers or invoices.
- Report history.
- Report submission to NAV or other authority.
- Client-side VAT recalculation.

## Source Inputs

- OpenAPI path `GET /api/v1/sellers`.
- OpenAPI path `GET /api/v1/vat-declarations/report`.
- OpenAPI path `GET /api/v1/vat-declarations/report/pdf`.
- UI reference: `frontend/docs/lld/pages/admin-ui-design-reference.template.md`.
- API base URL from runtime frontend config.
- User-selected seller and dates.

## Terms

- `Seller`: item returned by `/api/v1/sellers`.
- `Report filter`: `sellerId`, `dateFrom`, `dateTo`.
- `Report result`: `VatDeclarationReportResult`.
- `Inbound`: incoming invoice direction.
- `Outbound`: outgoing invoice direction.
- `VAT level`: numeric VAT percentage.

## Route

- Path: `/report`
- Navigation label: `VAT report`
- Page title: `VAT declaration`
- Access: authenticated route if auth is later added.

## UI Model

Components:

- `ReportPage`
  - Owns seller list state, filter state, report state, and PDF download state.
- `ReportFilterForm`
  - Seller select, date from input, date to input, submit button.
- `SellerSelect`
  - Shows seller name and tax number.
- `VatReportSummary`
  - Shows seller name and period.
- `VatReportTable`
  - Reused for inbound and outbound rows.
- `ReportErrorAlert`
  - Shows API and validation errors.
- `DownloadPdfButton`
  - Uses the last submitted valid filter for the displayed report.

State:

```ts
type SellersState =
  | { status: "loading" }
  | { status: "loaded"; items: SellerListItemDto[] }
  | { status: "failed"; error: PageError };

type ReportState =
  | { status: "idle" }
  | { status: "loading"; filter: VatReportFilter }
  | {
      status: "loaded";
      filter: VatReportFilter;
      result: VatDeclarationReportResult;
      isStale: boolean;
    }
  | { status: "failed"; filter?: VatReportFilter; error: PageError };
```

Default filter:

- On first render, set `dateFrom` to the current month first day in local browser
  time.
- On first render, set `dateTo` to the current month last day in local browser
  time.
- Format both defaults as `yyyy-MM-dd` for native date inputs and API query
  parameters.

## API Contract

### Sellers

`GET /api/v1/sellers`

Response:

```ts
type SellerListResponse = {
  items: SellerListItemDto[];
};

type SellerListItemDto = {
  id: string;
  name: string;
  taxNumber: string;
};
```

### JSON Report

`GET /api/v1/vat-declarations/report?sellerId={sellerId}&dateFrom={dateFrom}&dateTo={dateTo}`

Response:

```ts
type VatDeclarationReportResult = {
  header: VatDeclarationReportHeader;
  inbound: VatDeclarationReportRow[];
  outbound: VatDeclarationReportRow[];
};

type VatDeclarationReportHeader = {
  sellerId: string;
  sellerName: string;
  dateFrom: string;
  dateTo: string;
};

type VatDeclarationReportRow = {
  vatLevel: number;
  totalNetAmount: number;
  totalVatAmount: number;
  totalGrossAmount: number;
};
```

### PDF Report

`GET /api/v1/vat-declarations/report/pdf?sellerId={sellerId}&dateFrom={dateFrom}&dateTo={dateTo}`

Success:

- HTTP `200`
- `Content-Type: application/pdf`
- Browser downloads blob as `vat-declaration-report.pdf` unless filename is
  present in `Content-Disposition`.

Validation failure:

- HTTP `400`, `404`, or `500`
- JSON error body:

```ts
type VatDeclarationReportErrorResponse = {
  errors: VatDeclarationReportError[];
};

type VatDeclarationReportError = {
  field?: string | null;
  errorCode: string;
  message: string;
};
```

## Validation Rules

Client validation before report or PDF request:

- `sellerId` required.
- `dateFrom` required.
- `dateTo` required.
- Dates use browser date input value format `yyyy-MM-dd`.
- `dateFrom <= dateTo`.

Backend remains source of truth for GUID parsing, seller existence, report
aggregation, and PDF generation.

## Flow

1. User opens `/report`.
2. Page loads sellers from `/api/v1/sellers`.
3. Page renders seller select and date inputs.
4. User chooses seller, date from, and date to.
5. User clicks generate.
6. Client validates filter.
7. Client sends JSON report request.
8. Page renders header, inbound table, and outbound table.
9. If user edits form values after result load, mark displayed result stale.
10. User clicks PDF download for the displayed report.
11. Client sends PDF request with the last submitted valid filter.
12. Browser downloads PDF blob.

## Result Rendering

Header:

- Seller name from `result.header.sellerName`.
- Period from `result.header.dateFrom` to `result.header.dateTo`.

Tables:

- Two tables: `Incoming invoices` for `inbound`, `Outgoing invoices` for
  `outbound`.
- Columns:
  - VAT level
  - Total net amount
  - Total VAT amount
  - Total gross amount

Formatting:

- Use `hu-HU` number formatting.
- Money values show two fraction digits.
- VAT level keeps decimal precision from API.
- Do not recalculate totals in the browser.

Empty states:

- No sellers: show no-seller empty state and disable report submit.
- Empty inbound or outbound arrays: show table empty state.
- Rows with zero totals from API: render zero values.

## Error Handling

- `400`: render every backend validation error.
- `404`: show seller not found and ask user to refresh sellers.
- `500`: show generic report generation failure.
- PDF endpoint validation errors return JSON; parse JSON before treating response
  as blob.
- Network failure shows API connection failure text.
- Keep backend `message` and `errorCode` visible.
- Do not show stack traces or raw exception bodies.

## Runtime Configuration

Read API base URL from generated runtime config:

```ts
type RuntimeConfig = {
  apiProtocol: "http" | "https";
  apiHost: string;
  apiPort?: string;
  apiBaseUrl: string;
};
```

Build `apiBaseUrl` as:

- `${apiProtocol}://${apiHost}` when `apiPort` is empty.
- `${apiProtocol}://${apiHost}:${apiPort}` when `apiPort` has a value.

Production expected values:

- `apiProtocol=https`
- `apiHost=api.garamol.com`
- `apiPort=` empty unless reverse proxy exposes a non-standard port.
- Frontend app default port: `3000`.

## Logging And Audit

Frontend logs:

- Development only: seller load status, report request status, PDF request
  status, correlation ID if present, elapsed time.
- Do not log invoice-level amounts, tax numbers, or raw error bodies in
  production console.

Backend owns report logging. No frontend audit persistence.

## Idempotency And Retry

- Report and PDF endpoints are `GET` and retry-safe.
- No idempotency key is required.
- Retrying a report can return different data if imports changed between
  requests.
- PDF button uses the last submitted valid filter, not partially edited form
  state, when a JSON result is visible.
- If form values change after result load, mark the result as stale. The PDF
  button still downloads the displayed report using the last submitted valid
  filter.

## Accessibility

- Seller select has visible label.
- Date inputs have visible labels and browser-native date controls.
- Generate and PDF buttons expose busy state.
- Error container uses `role="alert"`.
- Report loaded message uses `role="status"`.
- Tables use `caption`, `thead`, and `tbody`.

## Edge Cases

- Sellers API returns empty list: disable submit and show empty state.
- Sellers API fails: show retry button.
- Selected seller disappears before report request: backend returns `404`.
- `dateFrom > dateTo`: block locally.
- User changes filter after report loaded: mark result as stale and keep PDF
  download tied to the displayed report.
- PDF download fails after JSON report succeeds: keep JSON result visible and
  show PDF-specific error.
- Browser blocks download: expose fallback link object URL during the click
  handler only.

## Assumptions

- Runtime config exposes API protocol, host, port, and computed base URL.
- App uses React Router or equivalent client routing.
- Authentication is not specified. Add credentials/auth headers only when shared
  auth design exists.
- OpenAPI contract from the backend is the source of truth for response fields.
- Backend handles CORS for `https://app.garamol.com` to
  `https://api.garamol.com`.

## Unit Test Strategy

- `GivenPageLoads_WhenSellersRequestSucceeds_ThenSellerOptionsRendered`
- `GivenPageLoads_WhenSellersRequestFails_ThenRetryErrorRendered`
- `GivenNoSellers_WhenLoaded_ThenSubmitDisabled`
- `GivenMissingSeller_WhenGenerateClicked_ThenShowsRequiredError`
- `GivenMissingDateFrom_WhenGenerateClicked_ThenShowsRequiredError`
- `GivenMissingDateTo_WhenGenerateClicked_ThenShowsRequiredError`
- `GivenDateFromAfterDateTo_WhenGenerateClicked_ThenShowsRangeError`
- `GivenValidFilter_WhenGenerateClicked_ThenCallsReportEndpointWithQuery`
- `GivenReportResult_WhenRendered_ThenShowsHeaderInboundAndOutboundTables`
- `GivenApiValidationError_WhenReportFails_ThenShowsBackendErrors`
- `GivenPdfClicked_WhenResultLoaded_ThenDownloadsPdfWithSameFilter`
- `GivenPdfErrorJson_WhenDownloadFails_ThenShowsPdfErrorAndKeepsReport`

Mock the API client and blob download helper. Do not mock pure formatters.

## Contract Test Strategy

- Provider contract owner: backend API.
- Consumer contract owner: frontend report page.
- Validate `/api/v1/sellers` response shape and seller option mapping.
- Validate JSON report query parameter names: `sellerId`, `dateFrom`, `dateTo`.
- Validate PDF report uses identical query parameters.
- Validate `400`, `404`, and `500` report errors use
  `VatDeclarationReportErrorResponse`.
- Validate PDF success has `application/pdf`.
- Keep golden fixtures for sellers list, valid report, empty report, validation
  error, seller not found, and PDF error JSON.
