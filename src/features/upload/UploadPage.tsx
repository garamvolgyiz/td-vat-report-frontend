import { DragEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { FileUp, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";
import { asUploadPageError, createUploadApi } from "../../api/uploadApi";
import type { BulkInvoiceImportError, BulkInvoiceImportResponse, UploadPageError } from "../../api/uploadTypes";
import { AdminPageLayout } from "../../components/AdminShell";
import { getRuntimeConfig } from "../../lib/runtimeConfig";

type UploadState =
  | { status: "idle" }
  | { status: "selected"; file: File }
  | { status: "uploading"; file: File; idempotencyKey: string; correlationId: string }
  | { status: "succeeded"; file: File; result: BulkInvoiceImportResponse }
  | {
      status: "failed";
      file?: File;
      error: UploadPageError;
      retryIdempotencyKey?: string;
    };

type LocalWarning = {
  code: string;
  message: string;
};

function createRequestId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `fallback-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function shouldLogUploadRequest(): boolean {
  return Boolean(import.meta.env.DEV && !import.meta.env.VITEST);
}

function validateFile(file?: File): BulkInvoiceImportError[] {
  if (!file) {
    return [{ scope: "file", errorCode: "file_required", message: "Select one XML file before uploading." }];
  }

  if (!file.name.toLowerCase().endsWith(".xml")) {
    return [{ scope: "file", errorCode: "unsupported_file_extension", message: "Upload an XML file." }];
  }

  return [];
}

function statusLabel(status: BulkInvoiceImportResponse["status"]): string {
  if (status === "completed") {
    return "Import completed";
  }

  if (status === "completed_with_errors") {
    return "Import completed with errors";
  }

  return "Import failed";
}

function compareNullableNumber(left?: number | null, right?: number | null): number {
  if (left == null && right == null) {
    return 0;
  }

  if (left == null) {
    return 1;
  }

  if (right == null) {
    return -1;
  }

  return left - right;
}

function sortImportErrors(errors: BulkInvoiceImportError[]): BulkInvoiceImportError[] {
  return [...errors].sort((left, right) => {
    const invoice = compareNullableNumber(left.invoiceIndex, right.invoiceIndex);
    if (invoice !== 0) {
      return invoice;
    }

    const line = compareNullableNumber(left.lineIndex, right.lineIndex);
    if (line !== 0) {
      return line;
    }

    return (left.field ?? "").localeCompare(right.field ?? "");
  });
}

export function UploadPage() {
  const api = useMemo(() => createUploadApi({ apiBaseUrl: getRuntimeConfig().apiBaseUrl }), []);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [validationErrors, setValidationErrors] = useState<BulkInvoiceImportError[]>([]);
  const [localWarning, setLocalWarning] = useState<LocalWarning | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const selectedFile = "file" in uploadState ? uploadState.file : undefined;
  const isUploading = uploadState.status === "uploading";

  function selectFiles(files: FileList | File[]) {
    const firstFile = files[0];
    const errors = validateFile(firstFile);
    setValidationErrors(errors);
    setLocalWarning(files.length > 1 ? { code: "multiple_files", message: "Only the first file was selected." } : null);

    if (!firstFile) {
      setUploadState({ status: "idle" });
      return;
    }

    setUploadState({ status: "selected", file: firstFile });
  }

  async function uploadSelectedFile(retryIdempotencyKey?: string) {
    const errors = validateFile(selectedFile);
    setValidationErrors(errors);
    setLocalWarning(null);
    if (errors.length > 0 || !selectedFile) {
      setUploadState({
        status: "failed",
        file: selectedFile,
        error: { title: "Upload file is invalid.", errors },
      });
      return;
    }

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const idempotencyKey = retryIdempotencyKey ?? createRequestId();
    const correlationId = createRequestId();
    const startedAt = performance.now();

    setUploadState({ status: "uploading", file: selectedFile, idempotencyKey, correlationId });
    try {
      const result = await api.importXml({
        file: selectedFile,
        idempotencyKey,
        correlationId,
        signal: abortController.signal,
      });

      if (abortController.signal.aborted) {
        return;
      }

      if (shouldLogUploadRequest()) {
        console.info("Upload request completed", {
          status: result.status,
          correlationId,
          elapsedMs: Math.round(performance.now() - startedAt),
        });
      }

      setUploadState({ status: "succeeded", file: selectedFile, result });
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      const pageError = asUploadPageError(error);
      if (shouldLogUploadRequest()) {
        console.info("Upload request failed", {
          correlationId: pageError.correlationId ?? correlationId,
          elapsedMs: Math.round(performance.now() - startedAt),
        });
      }

      setUploadState({
        status: "failed",
        file: selectedFile,
        error: pageError,
        retryIdempotencyKey: pageError.canRetryWithSameKey ? idempotencyKey : undefined,
      });
    }
  }

  function clearUpload() {
    abortControllerRef.current?.abort();
    setUploadState({ status: "idle" });
    setValidationErrors([]);
    setLocalWarning(null);
  }

  return (
    <AdminPageLayout title="XML upload" description="Import one VAT declaration XML file and review backend validation results.">
      <section className="panel" aria-labelledby="upload-panel-heading">
        <div className="panel-heading">
          <div>
            <h2 id="upload-panel-heading">Upload XML</h2>
            <p>Select or drop one XML file.</p>
          </div>
        </div>

        <XmlFileDropzone
          selectedFile={selectedFile}
          disabled={isUploading}
          errors={validationErrors}
          onFilesSelected={selectFiles}
        />

        <div className="upload-actions">
          <button className="button primary" type="button" disabled={isUploading} aria-busy={isUploading} onClick={() => void uploadSelectedFile()}>
            {isUploading ? <Loader2 className="spin" aria-hidden="true" size={16} /> : <Upload aria-hidden="true" size={16} />}
            Upload
          </button>
          <button className="button secondary" type="button" disabled={isUploading} onClick={clearUpload}>
            <Trash2 aria-hidden="true" size={16} />
            Clear
          </button>
        </div>
      </section>

      {localWarning ? (
        <Alert variant="warning" title="Only one file can be uploaded">
          <code>{localWarning.code}</code> {localWarning.message}
        </Alert>
      ) : null}

      {uploadState.status === "uploading" ? <Alert variant="info" title="Uploading XML">Upload request in progress.</Alert> : null}

      {uploadState.status === "failed" ? (
        <>
          <PageErrorAlert
            error={uploadState.error}
            onRetry={
              uploadState.retryIdempotencyKey ? () => void uploadSelectedFile(uploadState.retryIdempotencyKey) : undefined
            }
          />
          {uploadState.error.result ? (
            <>
              <ImportSummaryPanel result={uploadState.error.result} />
              <ImportErrorsTable errors={uploadState.error.result.errors} />
            </>
          ) : null}
        </>
      ) : null}

      {uploadState.status === "succeeded" ? (
        <>
          <Alert variant={uploadState.result.status === "failed" ? "danger" : "success"} title={statusLabel(uploadState.result.status)}>
            Batch <code>{uploadState.result.importBatchId}</code> processed from <strong>{uploadState.result.fileName}</strong>.
          </Alert>
          <ImportSummaryPanel result={uploadState.result} />
          <ImportErrorsTable errors={uploadState.result.errors} />
        </>
      ) : null}
    </AdminPageLayout>
  );
}

type XmlFileDropzoneProps = {
  selectedFile?: File;
  disabled: boolean;
  errors: BulkInvoiceImportError[];
  onFilesSelected: (files: FileList | File[]) => void;
};

function XmlFileDropzone({ selectedFile, disabled, errors, onFilesSelected }: XmlFileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileError = errors.find((error) => error.scope === "file");

  function openPicker() {
    if (!disabled) {
      inputRef.current?.click();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!disabled) {
      onFilesSelected(event.dataTransfer.files);
    }
  }

  return (
    <div className="field">
      <label id="xml-file-label" htmlFor="xml-file-input">
        XML file <span aria-hidden="true">*</span>
      </label>
      <div
        className="dropzone"
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-labelledby="xml-file-label"
        aria-describedby="xml-file-help xml-file-error selected-file"
        aria-disabled={disabled}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <FileUp aria-hidden="true" size={28} />
        <div>
          <strong>{selectedFile ? selectedFile.name : "Choose XML file"}</strong>
          <p id="xml-file-help" className="field-help">
            Drag one .xml file here or press Enter to browse.
          </p>
          {selectedFile ? (
            <p id="selected-file" className="selected-file">
              {(selectedFile.size / 1024).toLocaleString("hu-HU", { maximumFractionDigits: 1 })} KB
            </p>
          ) : null}
        </div>
      </div>
      <input
        ref={inputRef}
        id="xml-file-input"
        className="visually-hidden"
        type="file"
        accept=".xml,application/xml,text/xml"
        disabled={disabled}
        onChange={(event) => {
          if (event.currentTarget.files) {
            onFilesSelected(event.currentTarget.files);
          }
        }}
      />
      {fileError ? (
        <p id="xml-file-error" className="field-error">
          {fileError.message}
        </p>
      ) : null}
    </div>
  );
}

function ImportSummaryPanel({ result }: { result: BulkInvoiceImportResponse }) {
  const metrics = [
    { label: "Status", value: statusLabel(result.status) },
    { label: "Total invoices", value: result.summary.totalInvoices },
    { label: "Created invoices", value: result.summary.createdInvoices },
    { label: "Skipped invoices", value: result.summary.skippedInvoices },
    { label: "Failed invoices", value: result.summary.failedInvoices },
    { label: "Created lines", value: result.summary.createdLines },
  ];

  return (
    <section className="panel" aria-labelledby="import-summary-heading">
      <div className="panel-heading">
        <div>
          <h2 id="import-summary-heading">Import summary</h2>
          <p>{result.fileName}</p>
        </div>
      </div>
      <dl className="summary-grid import-summary-grid">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ImportErrorsTable({ errors }: { errors: BulkInvoiceImportError[] }) {
  const sortedErrors = sortImportErrors(errors);
  type OptionalColumn = {
    id: string;
    header: string;
    cell: (row: BulkInvoiceImportError) => string | number | null | undefined;
    numeric?: boolean;
    mono?: boolean;
  };

  const optionalColumns: OptionalColumn[] = [
    { id: "invoiceIndex", header: "Invoice index", cell: (row: BulkInvoiceImportError) => row.invoiceIndex, numeric: true },
    { id: "lineIndex", header: "Line index", cell: (row: BulkInvoiceImportError) => row.lineIndex, numeric: true },
    { id: "field", header: "Field", cell: (row: BulkInvoiceImportError) => row.field },
    { id: "sellerTaxNumber", header: "Seller tax number", cell: (row: BulkInvoiceImportError) => row.sellerTaxNumber },
    { id: "invoiceNumber", header: "Invoice number", cell: (row: BulkInvoiceImportError) => row.invoiceNumber },
    { id: "path", header: "XML path", cell: (row: BulkInvoiceImportError) => row.path, mono: true },
  ].filter((column) => sortedErrors.some((row) => column.cell(row) != null && column.cell(row) !== ""));

  const colSpan = 3 + optionalColumns.length;

  return (
    <section className="panel" aria-labelledby="import-errors-heading">
      <div className="panel-heading">
        <div>
          <h2 id="import-errors-heading">Import errors</h2>
          <p>Backend validation messages and support codes.</p>
        </div>
      </div>
      <div className="table-scroll">
        <table className="import-errors-table">
          <caption>Invoice import validation errors</caption>
          <thead>
            <tr>
              <th scope="col">Scope</th>
              <th scope="col">Code</th>
              <th scope="col">Message</th>
              {optionalColumns.map((column) => (
                <th key={column.id} scope="col" className={column.numeric ? "numeric" : undefined}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedErrors.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="empty-cell">
                  No invoice-level errors returned by the API.
                </td>
              </tr>
            ) : (
              sortedErrors.map((row, index) => (
                <tr key={`${row.errorCode}-${row.invoiceIndex ?? "file"}-${row.lineIndex ?? "line"}-${index}`}>
                  <td>{row.scope}</td>
                  <td>
                    <code>{row.errorCode}</code>
                  </td>
                  <td>{row.message}</td>
                  {optionalColumns.map((column) => {
                    const value = column.cell(row);
                    return (
                      <td key={column.id} className={`${column.numeric ? "numeric" : ""} ${column.mono ? "mono" : ""}`.trim()}>
                        {value ?? ""}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PageErrorAlert({ error, onRetry }: { error: UploadPageError; onRetry?: () => void }) {
  return (
    <Alert variant="danger" title={error.title}>
      {error.correlationId ? (
        <p>
          Correlation ID <code>{error.correlationId}</code>
        </p>
      ) : null}
      <ul className="error-list">
        {error.errors.map((item, index) => (
          <li key={`${item.errorCode}-${item.scope}-${index}`}>
            <code>{item.errorCode}</code>
            <span>{item.message}</span>
          </li>
        ))}
      </ul>
      {onRetry ? (
        <button className="button secondary alert-action" type="button" onClick={onRetry}>
          <RotateCcw aria-hidden="true" size={16} />
          Retry
        </button>
      ) : null}
    </Alert>
  );
}

function Alert({
  variant,
  title,
  children,
}: {
  variant: "success" | "warning" | "danger" | "info";
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className={`alert ${variant}`} role={variant === "danger" ? "alert" : "status"}>
      <strong>{title}</strong>
      {children ? <div className="alert-body">{children}</div> : null}
    </div>
  );
}
