import { describe, expect, it, vi } from "vitest";
import { createUploadApi, isBulkInvoiceImportResponse, UploadApiError } from "./uploadApi";
import type { BulkInvoiceImportResponse } from "./uploadTypes";

const completedResponse = {
  importBatchId: "batch-001",
  fileName: "invoices.xml",
  status: "completed",
  summary: {
    totalInvoices: 2,
    createdInvoices: 2,
    skippedInvoices: 0,
    failedInvoices: 0,
    createdLines: 4,
  },
  errors: [],
} satisfies BulkInvoiceImportResponse;

const completedWithErrorsResponse = {
  importBatchId: "batch-002",
  fileName: "invoices.xml",
  status: "completed_with_errors",
  summary: {
    totalInvoices: 2,
    createdInvoices: 1,
    skippedInvoices: 0,
    failedInvoices: 1,
    createdLines: 2,
  },
  errors: [
    {
      scope: "line",
      errorCode: "invalid_vat_rate",
      message: "VAT rate is not supported.",
      invoiceIndex: 1,
      lineIndex: 2,
      field: "vatRate",
      sellerTaxNumber: "12345678-2-42",
      invoiceNumber: "INV-002",
      path: "/Invoices/Invoice[2]/Lines/Line[2]/VatRate",
    },
  ],
} satisfies BulkInvoiceImportResponse;

const failedValidationResponse = {
  importBatchId: "batch-003",
  fileName: "broken.xml",
  status: "failed",
  summary: {
    totalInvoices: 0,
    createdInvoices: 0,
    skippedInvoices: 0,
    failedInvoices: 0,
    createdLines: 0,
  },
  errors: [{ scope: "file", errorCode: "xml_parse_error", message: "XML could not be parsed.", path: "/Invoices" }],
} satisfies BulkInvoiceImportResponse;

describe("upload API contract", () => {
  it("posts multipart file field with idempotency and correlation headers", async () => {
    const fetchFn = vi.fn().mockResolvedValue(Response.json(completedResponse));
    const api = createUploadApi({ apiBaseUrl: "https://api.example.test", fetchFn });
    const file = new File(["<xml />"], "invoices.xml", { type: "application/xml" });

    await expect(
      api.importXml({
        file,
        idempotencyKey: "idem-001",
        correlationId: "corr-001",
      }),
    ).resolves.toEqual(completedResponse);

    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/bulk-invoices/import",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Idempotency-Key": "idem-001",
          "X-Correlation-Id": "corr-001",
        },
      }),
    );
    const requestInit = fetchFn.mock.calls[0][1] as RequestInit;
    expect(requestInit.body).toBeInstanceOf(FormData);
    expect((requestInit.body as FormData).get("file")).toBe(file);
  });

  it("accepts completed, completed with errors, and failed import response bodies", () => {
    expect(isBulkInvoiceImportResponse(completedResponse)).toBe(true);
    expect(isBulkInvoiceImportResponse(completedWithErrorsResponse)).toBe(true);
    expect(isBulkInvoiceImportResponse(failedValidationResponse)).toBe(true);
  });

  it("preserves 400 import response errors and summary", async () => {
    const fetchFn = vi.fn().mockResolvedValue(Response.json(failedValidationResponse, { status: 400 }));
    const api = createUploadApi({ apiBaseUrl: "https://api.example.test", fetchFn });

    const expectedError: Partial<UploadApiError> = {
      pageError: {
        title: "Import validation failed.",
        errors: failedValidationResponse.errors,
        correlationId: "corr-400",
        result: failedValidationResponse,
      },
    };

    await expect(
      api.importXml({
        file: new File([""], "broken.xml"),
        idempotencyKey: "idem-400",
        correlationId: "corr-400",
      }),
    ).rejects.toMatchObject(expectedError);
  });

  it("maps payload too large and unsupported media type responses", async () => {
    const tooLargeApi = createUploadApi({
      apiBaseUrl: "https://api.example.test",
      fetchFn: vi.fn().mockResolvedValue(new Response(null, { status: 413 })),
    });
    const unsupportedApi = createUploadApi({
      apiBaseUrl: "https://api.example.test",
      fetchFn: vi.fn().mockResolvedValue(new Response(null, { status: 415 })),
    });

    await expect(
      tooLargeApi.importXml({ file: new File(["x"], "big.xml"), idempotencyKey: "idem-413", correlationId: "corr-413" }),
    ).rejects.toMatchObject({ pageError: { title: "The file is too large.", correlationId: "corr-413" } });
    await expect(
      unsupportedApi.importXml({ file: new File(["x"], "bad.xml"), idempotencyKey: "idem-415", correlationId: "corr-415" }),
    ).rejects.toMatchObject({
      pageError: { title: "Unsupported file type. Upload an XML file.", correlationId: "corr-415" },
    });
  });
});
