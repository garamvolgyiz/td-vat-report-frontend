# Upload Page LLD

## Purpose

Define the React TypeScript `/upload` page where a user uploads one XML file and
sends it to `POST /api/v1/bulk-invoices/import`.

## Scope

In scope:

- Select or drag one `.xml` file.
- Upload with `multipart/form-data` field `file`.
- Generate and send frontend-required `Idempotency-Key` before every upload
  request.
- Send frontend-generated `X-Correlation-Id` header for support tracing.
- Show import summary and invoice-level errors returned by the API.
- Show fatal validation, upload size, unsupported media type, network, and server
  errors.

Out of scope:

- Editing XML before upload.
- Bulk upload of multiple files.
- Manual invoice correction UI.
- Template generation UI.

## Source Inputs

- OpenAPI path `POST /api/v1/bulk-invoices/import`.
- UI reference: `frontend/docs/lld/pages/admin-ui-design-reference.template.md`.
- API base URL from runtime frontend config.
- User-selected XML file.
- Browser-generated upload request.

## Terms

- `SelectedFile`: browser `File` chosen by the user.
- `ImportResult`: `BulkInvoiceImportResponse` from the backend.
- `Fatal error`: API response where status is `failed` or HTTP status prevents
  invoice processing.
- `Recoverable error`: row in `errors` for invoice, line, seller, buyer,
  address, or VAT rate scopes.

## Route

- Path: `/upload`
- Navigation label: `Upload`
- Page title: `XML upload`
- Access: authenticated route if auth is later added.

## UI Model

Components:

- `UploadPage`
  - Owns selected file, upload state, and result state.
- `XmlFileDropzone`
  - Accepts click select and drag/drop.
  - Accepts one file only.
- `ImportSummaryPanel`
  - Renders status and numeric counters.
- `ImportErrorsTable`
  - Renders backend errors with sorting by invoice index, line index, and field.
- `PageErrorAlert`
  - Renders fatal, network, and unexpected errors.

State:

```ts
type UploadState =
  | { status: "idle" }
  | { status: "selected"; file: File }
  | { status: "uploading"; file: File }
  | { status: "succeeded"; file: File; result: BulkInvoiceImportResponse }
  | { status: "failed"; file?: File; error: UploadPageError };
```

## API Contract

### Request

`POST /api/v1/bulk-invoices/import`

Headers:

- `Content-Type`: set by browser for `multipart/form-data`.
- `Idempotency-Key`: frontend-generated UUID per selected file upload attempt.
  Frontend always sends it; backend accepts it as optional for non-UI callers.
- `X-Correlation-Id`: frontend-generated UUID per request. Backend can generate
  one for non-UI callers if missing.

Body:

- `FormData`
- Field `file`: selected XML file.

### Success Response

HTTP `200` returns:

```ts
type BulkInvoiceImportResponse = {
  importBatchId: string;
  fileName: string;
  status: "completed" | "completed_with_errors" | "failed";
  summary: BulkInvoiceImportSummary;
  errors: BulkInvoiceImportError[];
};

type BulkInvoiceImportSummary = {
  totalInvoices: number;
  createdInvoices: number;
  skippedInvoices: number;
  failedInvoices: number;
  createdLines: number;
};

type BulkInvoiceImportError = {
  scope: "file" | "invoice" | "line" | "seller" | "buyer" | "address" | "vat_rate";
  errorCode: string;
  message: string;
  path?: string | null;
  invoiceIndex?: number | null;
  lineIndex?: number | null;
  field?: string | null;
  sellerTaxNumber?: string | null;
  sellerName?: string | null;
  invoiceNumber?: string | null;
};
```

### Error Responses

- `400`: parse as `BulkInvoiceImportResponse` and render all `errors`.
- `413`: show `The file is too large.`
- `415`: show `Unsupported file type. Upload an XML file.`
- `500`: show generic server failure text.
- Network failure: show API connection failure text.

If response content type is JSON and shape contains `errors`, render each error.
If JSON parse fails, render HTTP status and generic text.

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

## Validation Rules

Client validation before request:

- File required.
- One file only.
- File extension should be `.xml`.
- MIME type may be empty in some browsers. Do not reject solely because MIME type
  is empty.
- Do not enforce final file size unless backend limit is exposed in config.

Backend remains source of truth for XML structure, business validation, VAT
rates, duplicates, and size limit.

## Flow

1. User opens `/upload`.
2. Page renders idle dropzone.
3. User selects or drops one file.
4. Client validates presence and extension.
5. User clicks upload.
6. Client generates unique `Idempotency-Key`.
7. Client builds `FormData` with `file`.
8. Client sends request to `${apiBaseUrl}/api/v1/bulk-invoices/import`.
9. Disable file controls while request is pending.
10. On `200`, render summary and any recoverable errors.
11. On `400`, render failed summary and file-level errors.
12. On other errors, render page alert.
13. User can clear result and choose another file.

## Result Rendering

Status labels:

- `completed`: import completed.
- `completed_with_errors`: import completed with errors.
- `failed`: import failed.

Summary fields:

- `totalInvoices`
- `createdInvoices`
- `skippedInvoices`
- `failedInvoices`
- `createdLines`

Error table columns:

- Scope
- Code
- Message
- Invoice index
- Line index
- Field
- Seller tax number
- Invoice number
- XML path

Hide optional columns only when every row has no value for that column.

## Error Handling

- Keep backend `message` visible because it is user-facing per API contract.
- Keep backend `errorCode` visible for support.
- Do not show stack traces or raw exception bodies.
- Preserve `X-Correlation-Id` in state and show it when a request fails.
- Retry button reuses the same idempotency key only when the previous attempt
  ended with no backend response because of a network failure.
- Retry button uses a new idempotency key after any visible backend response.

## Logging And Audit

Frontend logs:

- Development only: request status, correlation ID, elapsed time.
- Do not log XML content, seller names, buyer names, addresses, tax numbers, or
  invoice numbers to console in production.

Backend owns persistent audit via import batch and import errors.

## Idempotency And Retry

- Generate one unique `Idempotency-Key` before the request starts.
- Do not send an upload request without `Idempotency-Key`.
- Keep the key while the request is in flight.
- If the browser receives no response because of network failure, retry may reuse
  the same key.
- After a visible backend response, the next upload attempt gets a new key.

## Accessibility

- File input has visible label.
- Dropzone is keyboard reachable.
- Upload button has disabled and busy states.
- Result alert uses `role="status"` for success and `role="alert"` for failure.
- Error table uses semantic table markup.

## Edge Cases

- Empty file selected: allow request; backend returns `empty_file`.
- Wrong extension: block client request with local validation.
- User drops multiple files: keep first file and show local warning.
- Browser sends empty MIME type: allow if extension is `.xml`.
- API returns `completed_with_errors` with `200`: show success summary and error
  table, not page failure.
- API returns `failed` with `200`: show failed summary and error table.
- User navigates away during upload: abort request with `AbortController`.

## Assumptions

- Runtime config exposes `apiBaseUrl`.
- App uses React Router or equivalent client routing.
- Authentication is not specified. Add credentials/auth headers only when shared
  auth design exists.
- OpenAPI contract from the backend is the source of truth for response fields.

## Unit Test Strategy

- `GivenNoFile_WhenUploadClicked_ThenShowsRequiredFileError`
- `GivenNonXmlFile_WhenSelected_ThenShowsInvalidExtensionError`
- `GivenXmlFile_WhenUploadClicked_ThenPostsMultipartFileField`
- `GivenCompletedResponse_WhenRendered_ThenShowsSummaryWithoutErrorAlert`
- `GivenCompletedWithErrors_WhenRendered_ThenShowsSummaryAndErrorRows`
- `GivenBadRequestImportResponse_WhenRendered_ThenShowsBackendErrors`
- `GivenPayloadTooLarge_WhenReturned_ThenShowsSizeError`
- `GivenUnsupportedMediaType_WhenReturned_ThenShowsTypeError`
- `GivenNetworkFailure_WhenUploading_ThenShowsConnectionErrorWithCorrelationId`
- `GivenUnmountDuringUpload_WhenRequestPending_ThenAbortsRequest`

Mock the API client. Do not mock pure response mappers.

## Contract Test Strategy

- Provider contract owner: backend API.
- Consumer contract owner: frontend upload page.
- Validate `multipart/form-data` field name remains `file`.
- Validate frontend upload requests include `Idempotency-Key` and
  `X-Correlation-Id`.
- Validate `200` and `400` bodies match `BulkInvoiceImportResponse`.
- Validate `status` enum values remain `completed`, `completed_with_errors`, and
  `failed`.
- Validate error `scope` enum and optional fields remain camel case.
- Keep golden response fixtures for completed, completed with errors, fatal XML
  validation, `413`, and `415`.
