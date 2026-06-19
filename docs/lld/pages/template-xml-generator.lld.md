# Template XML Generator Page LLD

## Purpose

Define the React TypeScript `/template-xml-generator` page where a user enters
bulk invoice template parameters, generates an XML template, and downloads the
result for later upload on the `/upload` page.

## Scope

In scope:

- Capture request parameters for `GET /api/v1/bulk-invoices/template`.
- Validate numeric ranges and date combination rules before sending the request.
- Generate and download the XML response as `bulk-invoices-template.xml`.
- Show backend validation errors and server/network failures to the user.
- Keep the generated template workflow separate from XML import.

Out of scope:

- Uploading the generated XML.
- Editing generated XML in the browser.
- Persisting previous template requests.
- Client-side invoice or VAT rate generation.

## Source Inputs

- OpenAPI path `GET /api/v1/bulk-invoices/template`.
- UI reference: `frontend/docs/lld/pages/admin-ui-design-reference.template.md`.
- API base URL from runtime frontend config.
- User-entered generator parameters.

## Terms

- `Template filter`: query parameters sent to the template endpoint.
- `Exact issue date`: one date applied to every generated invoice.
- `Issue date range`: inclusive `issueDateFrom` and `issueDateTo` bounds.
- `Backend validation error`: row in `BulkInvoiceTemplateErrorResponse.errors`.

## Route

- Path: `/template-xml-generator`
- Navigation label: `Template XML`
- Page title: `Template XML generator`
- Access: authenticated route if auth is later added.

## UI Model

Components:

- `TemplateXmlGeneratorPage`
  - Owns form state, validation state, request state, and download state.
- `TemplateGeneratorForm`
  - Renders generator fields and submit/reset actions.
- `IssueDateModeControl`
  - Segmented control for no date, exact date, or date range.
- `TemplateErrorAlert`
  - Shows client validation and backend errors.
- `DownloadStatusPanel`
  - Shows last successful generation filename, parameter summary, and time.

State:

```ts
type TemplateGeneratorFormData = {
  numberOfInvoices: string;
  maxNumberOfLinesPerInvoice: string;
  invoiceNumberPrefix: string;
  issueDateMode: "none" | "exact" | "range";
  issueDate: string;
  issueDateFrom: string;
  issueDateTo: string;
};

type TemplateGeneratorState =
  | { status: "idle" }
  | { status: "validating" }
  | { status: "generating"; filter: BulkInvoiceTemplateFilter }
  | {
      status: "succeeded";
      filter: BulkInvoiceTemplateFilter;
      fileName: string;
      generatedAt: string;
    }
  | { status: "failed"; filter?: BulkInvoiceTemplateFilter; error: TemplatePageError };
```

## API Contract

### Request

`GET /api/v1/bulk-invoices/template`

Query parameters:

```ts
type BulkInvoiceTemplateFilter = {
  numberOfInvoices: number;
  maxNumberOfLinesPerInvoice: number;
  invoiceNumberPrefix?: string;
  issueDate?: string;
  issueDateFrom?: string;
  issueDateTo?: string;
};
```

Parameters:

- `numberOfInvoices`
  - Required integer.
  - Minimum: `1`.
  - Maximum: `1000`.
- `maxNumberOfLinesPerInvoice`
  - Required integer.
  - Minimum: `1`.
  - Maximum: `100`.
- `invoiceNumberPrefix`
  - Optional string.
  - Maximum length: `20`.
  - Pattern: `^[A-Za-z0-9._/-]*$`.
  - Allowed characters: letters, digits, `.`, `_`, `/`, and `-`.
- `issueDate`
  - Optional `yyyy-MM-dd` date.
  - Cannot be combined with `issueDateFrom` or `issueDateTo`.
- `issueDateFrom`
  - Optional inclusive lower date bound.
  - Must be provided together with `issueDateTo`.
- `issueDateTo`
  - Optional inclusive upper date bound.
  - Must be provided together with `issueDateFrom`.

Build the URL with `URLSearchParams`. Omit optional fields when their trimmed
value is empty.

### Success Response

HTTP `200` returns:

- `Content-Type: application/xml`
- `Content-Disposition: attachment; filename="bulk-invoices-template.xml"`
- Body: XML document string/blob.

The browser downloads the response as a blob. Prefer the filename from
`Content-Disposition`; otherwise use `bulk-invoices-template.xml`.

### Error Responses

HTTP `400` returns:

```ts
type BulkInvoiceTemplateErrorResponse = {
  errors: BulkInvoiceTemplateError[];
};

type BulkInvoiceTemplateError = {
  field?: string | null;
  errorCode: string;
  message: string;
};
```

Other failures:

- `500`: unexpected server failure.
- Network failure: API connection failure.
- Invalid or unreadable response: unexpected template response.

If response content type is JSON and shape contains `errors`, render each
backend error. If JSON parsing fails, render HTTP status and generic text. Do not
show stack traces or raw exception bodies.

## Validation Rules

Client validation before request:

- `numberOfInvoices` is required, integer-only, `1..1000`.
- `maxNumberOfLinesPerInvoice` is required, integer-only, `1..100`.
- `invoiceNumberPrefix` is optional, trimmed, max `20` characters, matches
  `^[A-Za-z0-9._/-]*$`.
- Date inputs use native `<input type="date">` values in `yyyy-MM-dd` format.
- `issueDateMode = "none"` sends no date query parameters.
- `issueDateMode = "exact"` requires `issueDate` and sends only `issueDate`.
- `issueDateMode = "range"` requires both `issueDateFrom` and `issueDateTo`.
- `issueDateFrom <= issueDateTo` for range mode.
- Exact date mode and range mode are mutually exclusive.

Backend remains source of truth for active VAT rates and final parameter
validation.

## Flow

1. User opens `/template-xml-generator`.
2. Page renders generator form with defaults:
   - `numberOfInvoices = 1`
   - `maxNumberOfLinesPerInvoice = 1`
   - empty `invoiceNumberPrefix`
   - `issueDateMode = "none"`
3. User edits numeric fields, optional prefix, and optional issue date settings.
4. User clicks generate.
5. Client validates form values.
6. Client builds query string from the valid filter.
7. Client sends `GET ${apiBaseUrl}/api/v1/bulk-invoices/template`.
8. Disable inputs and generate button while request is pending.
9. On `200`, download the XML blob and show success status.
10. On `400`, render all backend validation errors.
11. On `500` or network failure, render page error with retry action.
12. User can adjust values and generate a new template.

## Result Rendering

Success panel:

- Filename.
- Number of invoices.
- Maximum lines per invoice.
- Prefix or `None`.
- Issue date mode and selected date/range.
- Generated timestamp in local browser time.

Errors:

- Client validation errors appear below related fields and in the error summary.
- Backend errors show field, code, and message.
- Unknown field values remain visible as returned by the API.

## Error Handling

- Keep backend `message` visible because it is user-facing per API contract.
- Keep backend `errorCode` visible for support.
- Show `field` next to each backend error when present.
- `400`: render every backend validation error.
- `500`: show generic template generation failure.
- Network failure: show API connection failure text and retry action.
- XML blob creation failure: show `Template downloaded response could not be saved.`
- Do not log or render raw XML response on failure.

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

- Development only: template request status, HTTP status, and elapsed time.
- Do not log generated XML, tax numbers, or raw error bodies in production
  console.

Backend owns template generation logging. No frontend audit persistence.

## Idempotency And Retry

- Template endpoint is `GET` and retry-safe.
- No idempotency key is required.
- Retry uses the same validated query parameters unless the user edits the form.
- A later successful generation replaces the previous success status.

## Accessibility

- Every input has a visible label.
- Numeric inputs expose `min`, `max`, `step="1"`, and helper text.
- Date mode uses a labelled segmented control or radio group.
- Generate button exposes busy state and keeps width stable.
- Error container uses `role="alert"`.
- Success status uses `role="status"`.
- Download is triggered by user action; no automatic page navigation.

## Edge Cases

- Prefix contains spaces: trim before validation and request.
- Prefix contains unsupported characters: block locally.
- Prefix is longer than `20` characters: block locally.
- User switches from exact date to range: clear `issueDate`.
- User switches from range to exact date: clear `issueDateFrom` and
  `issueDateTo`.
- `issueDateFrom > issueDateTo`: block locally.
- Backend returns missing active VAT rates as `400`: show backend errors.
- Backend returns XML with no filename header: use fallback filename.
- Browser blocks object URL download: keep success status and expose secondary
  manual download action while the blob URL is valid.

## Assumptions

- OpenAPI contract from the backend is the source of truth for request fields and
  error response fields.
- Backend handles CORS for `https://app.garamol.com` to
  `https://api.garamol.com`.
- Authentication is not specified. Add credentials/auth headers only when shared
  auth design exists.
- Generated XML is upload-compatible with the `/upload` page import endpoint.

## Unit Test Strategy

- `GivenPageLoads_WhenRendered_ThenDefaultFormValuesShown`
- `GivenMissingNumberOfInvoices_WhenGenerateClicked_ThenShowsRequiredError`
- `GivenNumberOfInvoicesOutOfRange_WhenGenerateClicked_ThenShowsRangeError`
- `GivenMissingMaxLines_WhenGenerateClicked_ThenShowsRequiredError`
- `GivenMaxLinesOutOfRange_WhenGenerateClicked_ThenShowsRangeError`
- `GivenInvalidPrefix_WhenGenerateClicked_ThenShowsPatternError`
- `GivenExactDateModeWithoutDate_WhenGenerateClicked_ThenShowsDateError`
- `GivenRangeModeWithOneDate_WhenGenerateClicked_ThenShowsBothDatesRequiredError`
- `GivenRangeModeWithFromAfterTo_WhenGenerateClicked_ThenShowsRangeError`
- `GivenValidRequiredFields_WhenGenerateClicked_ThenCallsTemplateEndpoint`
- `GivenValidOptionalFields_WhenGenerateClicked_ThenBuildsExpectedQueryString`
- `GivenSuccessXml_WhenGenerateClicked_ThenDownloadsXmlFile`
- `GivenApiValidationError_WhenGenerateFails_ThenShowsBackendErrors`
- `GivenNetworkFailure_WhenGenerateFails_ThenShowsRetryError`

Mock the API client and blob download helper. Do not mock pure validators or
query-string builders.

## Contract Test Strategy

- Provider contract owner: backend API.
- Consumer contract owner: frontend template XML generator page.
- Validate endpoint path: `/api/v1/bulk-invoices/template`.
- Validate query parameter names:
  - `numberOfInvoices`
  - `maxNumberOfLinesPerInvoice`
  - `invoiceNumberPrefix`
  - `issueDate`
  - `issueDateFrom`
  - `issueDateTo`
- Validate `200` response is treated as XML/blob.
- Validate `Content-Disposition` filename extraction.
- Validate `400` error uses `BulkInvoiceTemplateErrorResponse`.
- Keep golden fixtures for valid XML, missing required parameter, invalid prefix,
  invalid date combination, missing active VAT rates, and server failure.
