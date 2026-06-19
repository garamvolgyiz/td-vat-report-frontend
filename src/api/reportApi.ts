import type {
  PageError,
  PdfDownload,
  SellerListResponse,
  VatDeclarationReportError,
  VatDeclarationReportErrorResponse,
  VatDeclarationReportResult,
  VatReportFilter,
} from "./reportTypes";

type ApiClientOptions = {
  apiBaseUrl: string;
  fetchFn?: typeof fetch;
};

function buildReportUrl(apiBaseUrl: string, path: string, filter: VatReportFilter): string {
  const url = new URL(`${apiBaseUrl}${path}`);
  url.searchParams.set("sellerId", filter.sellerId);
  url.searchParams.set("dateFrom", filter.dateFrom);
  url.searchParams.set("dateTo", filter.dateTo);
  return url.toString();
}

function isErrorResponse(value: unknown): value is VatDeclarationReportErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "errors" in value &&
    Array.isArray((value as VatDeclarationReportErrorResponse).errors)
  );
}

function titleForStatus(status: number): string {
  if (status === 400) {
    return "Report filter is invalid.";
  }

  if (status === 404) {
    return "Seller was not found. Refresh sellers and try again.";
  }

  if (status >= 500) {
    return "Report generation failed.";
  }

  return `Request failed with HTTP ${status}.`;
}

async function parseErrorResponse(response: Response): Promise<PageError> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body: unknown = await response.json();
      if (isErrorResponse(body)) {
        return {
          title: titleForStatus(response.status),
          errors: body.errors,
        };
      }
    } catch {
      return {
        title: titleForStatus(response.status),
        errors: [{ errorCode: "invalid_error_response", message: "API returned an unreadable error response." }],
      };
    }
  }

  return {
    title: titleForStatus(response.status),
    errors: [{ errorCode: "http_error", message: `Request failed with HTTP ${response.status}.` }],
  };
}

function networkError(): PageError {
  return {
    title: "API connection failed.",
    errors: [{ errorCode: "network_failure", message: "Could not connect to the API." }],
  };
}

function fileNameFromDisposition(disposition: string | null): string {
  if (!disposition) {
    return "vat-declaration-report.pdf";
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1].replace(/"/g, ""));
  }

  const quotedMatch = /filename="([^"]+)"/i.exec(disposition);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const plainMatch = /filename=([^;]+)/i.exec(disposition);
  return plainMatch?.[1]?.trim() ?? "vat-declaration-report.pdf";
}

export class ReportApiError extends Error {
  readonly pageError: PageError;

  constructor(pageError: PageError) {
    super(pageError.title);
    this.name = "ReportApiError";
    this.pageError = pageError;
  }
}

export function createReportApi({ apiBaseUrl, fetchFn = fetch }: ApiClientOptions) {
  async function requestJson<T>(url: string): Promise<T> {
    let response: Response;
    try {
      response = await fetchFn(url);
    } catch {
      throw new ReportApiError(networkError());
    }

    if (!response.ok) {
      throw new ReportApiError(await parseErrorResponse(response));
    }

    return response.json() as Promise<T>;
  }

  return {
    listSellers(): Promise<SellerListResponse> {
      return requestJson<SellerListResponse>(`${apiBaseUrl}/api/v1/sellers`);
    },

    getReport(filter: VatReportFilter): Promise<VatDeclarationReportResult> {
      return requestJson<VatDeclarationReportResult>(
        buildReportUrl(apiBaseUrl, "/api/v1/vat-declarations/report", filter),
      );
    },

    async downloadPdf(filter: VatReportFilter): Promise<PdfDownload> {
      let response: Response;
      try {
        response = await fetchFn(buildReportUrl(apiBaseUrl, "/api/v1/vat-declarations/report/pdf", filter));
      } catch {
        throw new ReportApiError(networkError());
      }

      if (!response.ok) {
        throw new ReportApiError(await parseErrorResponse(response));
      }

      return {
        blob: await response.blob(),
        fileName: fileNameFromDisposition(response.headers.get("content-disposition")),
      };
    },
  };
}

export function asPageError(error: unknown): PageError {
  if (error instanceof ReportApiError) {
    return error.pageError;
  }

  return {
    title: "Unexpected report error.",
    errors: [{ errorCode: "unexpected_error", message: "Unexpected report error." }],
  };
}
