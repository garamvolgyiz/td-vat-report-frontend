import type { BulkInvoiceImportError, BulkInvoiceImportResponse, UploadPageError, UploadRequestMetadata } from "./uploadTypes";

type UploadApiOptions = {
  apiBaseUrl: string;
  fetchFn?: typeof fetch;
};

type ImportXmlOptions = UploadRequestMetadata & {
  file: File;
  signal?: AbortSignal;
};

const validStatuses = new Set(["completed", "completed_with_errors", "failed"]);
const validScopes = new Set(["file", "invoice", "line", "seller", "buyer", "address", "vat_rate"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSummary(value: unknown): value is BulkInvoiceImportResponse["summary"] {
  return (
    isObject(value) &&
    typeof value.totalInvoices === "number" &&
    typeof value.createdInvoices === "number" &&
    typeof value.skippedInvoices === "number" &&
    typeof value.failedInvoices === "number" &&
    typeof value.createdLines === "number"
  );
}

function isImportError(value: unknown): value is BulkInvoiceImportError {
  return (
    isObject(value) &&
    typeof value.scope === "string" &&
    validScopes.has(value.scope) &&
    typeof value.errorCode === "string" &&
    typeof value.message === "string"
  );
}

export function isBulkInvoiceImportResponse(value: unknown): value is BulkInvoiceImportResponse {
  return (
    isObject(value) &&
    typeof value.importBatchId === "string" &&
    typeof value.fileName === "string" &&
    typeof value.status === "string" &&
    validStatuses.has(value.status) &&
    isSummary(value.summary) &&
    Array.isArray(value.errors) &&
    value.errors.every(isImportError)
  );
}

function titleForStatus(status: number): string {
  if (status === 400) {
    return "Import validation failed.";
  }

  if (status === 413) {
    return "The file is too large.";
  }

  if (status === 415) {
    return "Unsupported file type. Upload an XML file.";
  }

  if (status >= 500) {
    return "Upload failed on the server.";
  }

  return `Upload failed with HTTP ${status}.`;
}

async function parseErrorResponse(response: Response, correlationId: string): Promise<UploadPageError> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body: unknown = await response.json();
      if (isBulkInvoiceImportResponse(body)) {
        return {
          title: titleForStatus(response.status),
          errors: body.errors,
          correlationId,
          result: body,
        };
      }
    } catch {
      return {
        title: titleForStatus(response.status),
        errors: [{ scope: "file", errorCode: "invalid_error_response", message: "API returned an unreadable error response." }],
        correlationId,
      };
    }
  }

  return {
    title: titleForStatus(response.status),
    errors: [{ scope: "file", errorCode: "http_error", message: `Request failed with HTTP ${response.status}.` }],
    correlationId,
  };
}

function networkError(correlationId: string): UploadPageError {
  return {
    title: "API connection failed.",
    errors: [{ scope: "file", errorCode: "network_failure", message: "Could not connect to the API." }],
    correlationId,
    canRetryWithSameKey: true,
  };
}

export class UploadApiError extends Error {
  readonly pageError: UploadPageError;

  constructor(pageError: UploadPageError) {
    super(pageError.title);
    this.name = "UploadApiError";
    this.pageError = pageError;
  }
}

export function createUploadApi({ apiBaseUrl, fetchFn = fetch }: UploadApiOptions) {
  return {
    async importXml({ file, idempotencyKey, correlationId, signal }: ImportXmlOptions): Promise<BulkInvoiceImportResponse> {
      const formData = new FormData();
      formData.set("file", file);

      let response: Response;
      try {
        response = await fetchFn(`${apiBaseUrl}/api/v1/bulk-invoices/import`, {
          method: "POST",
          headers: {
            "Idempotency-Key": idempotencyKey,
            "X-Correlation-Id": correlationId,
          },
          body: formData,
          signal,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }
        throw new UploadApiError(networkError(correlationId));
      }

      if (!response.ok) {
        throw new UploadApiError(await parseErrorResponse(response, correlationId));
      }

      const body: unknown = await response.json();
      if (!isBulkInvoiceImportResponse(body)) {
        throw new UploadApiError({
          title: "Unexpected import response.",
          errors: [{ scope: "file", errorCode: "invalid_success_response", message: "API returned an unreadable import response." }],
          correlationId,
        });
      }

      return body;
    },
  };
}

export function asUploadPageError(error: unknown): UploadPageError {
  if (error instanceof UploadApiError) {
    return error.pageError;
  }

  return {
    title: "Unexpected upload error.",
    errors: [{ scope: "file", errorCode: "unexpected_error", message: "Unexpected upload error." }],
  };
}
