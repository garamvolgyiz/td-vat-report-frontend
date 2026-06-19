import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadPage } from "./UploadPage";

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
};

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
};

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
};

function xmlFile() {
  return new File(["<Invoices />"], "invoices.xml", { type: "application/xml" });
}

function uploadInput() {
  return screen.getByLabelText(/xml file/i, { selector: "input" });
}

describe("UploadPage", () => {
  beforeEach(() => {
    window.__RUNTIME_CONFIG__ = { apiBaseUrl: "https://api.example.test" };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows required file error when upload is clicked without a file", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<UploadPage />);

    await userEvent.click(screen.getByRole("button", { name: /^upload$/i }));

    expect(screen.getAllByText("Select one XML file before uploading.").length).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows invalid extension error when a non-XML file is selected", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<UploadPage />);

    await userEvent.upload(uploadInput(), new File(["text"], "invoice.txt", { type: "text/plain" }), {
      applyAccept: false,
    });

    expect(screen.getByText("Upload an XML file.")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts XML file and renders completed summary without error alert", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(completedResponse));
    vi.stubGlobal("fetch", fetchMock);
    render(<UploadPage />);

    await userEvent.upload(uploadInput(), xmlFile());
    await userEvent.click(screen.getByRole("button", { name: /^upload$/i }));

    expect((await screen.findAllByText("Import completed")).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Import summary" })).toBeInTheDocument();
    expect(screen.getByText("No invoice-level errors returned by the API.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect((requestInit.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("renders completed-with-errors summary and error rows", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(completedWithErrorsResponse)));
    render(<UploadPage />);

    await userEvent.upload(uploadInput(), xmlFile());
    await userEvent.click(screen.getByRole("button", { name: /^upload$/i }));

    expect((await screen.findAllByText("Import completed with errors")).length).toBeGreaterThan(0);
    expect(screen.getByText("invalid_vat_rate")).toBeInTheDocument();
    expect(screen.getByText("VAT rate is not supported.")).toBeInTheDocument();
    expect(screen.getByText("INV-002")).toBeInTheDocument();
  });

  it("renders bad request import response errors and summary", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(failedValidationResponse, { status: 400 })));
    render(<UploadPage />);

    await userEvent.upload(uploadInput(), xmlFile());
    await userEvent.click(screen.getByRole("button", { name: /^upload$/i }));

    expect(await screen.findByText("Import validation failed.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Import summary" })).toBeInTheDocument();
    expect(screen.getAllByText("xml_parse_error").length).toBeGreaterThan(0);
    expect(screen.getAllByText("XML could not be parsed.").length).toBeGreaterThan(0);
  });

  it("shows payload too large and unsupported media type errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 413 }))
      .mockResolvedValueOnce(new Response(null, { status: 415 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<UploadPage />);

    await userEvent.upload(uploadInput(), xmlFile());
    await userEvent.click(screen.getByRole("button", { name: /^upload$/i }));
    expect(await screen.findByText("The file is too large.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^upload$/i }));
    expect(await screen.findByText("Unsupported file type. Upload an XML file.")).toBeInTheDocument();
  });

  it("shows network failure with correlation id and retry action", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));
    render(<UploadPage />);

    await userEvent.upload(uploadInput(), xmlFile());
    await userEvent.click(screen.getByRole("button", { name: /^upload$/i }));

    expect(await screen.findByText("API connection failed.")).toBeInTheDocument();
    expect(screen.getByText(/Correlation ID/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("aborts the upload request when unmounted", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return new Promise<Response>(() => {});
      }),
    );
    const view = render(<UploadPage />);

    await userEvent.upload(uploadInput(), xmlFile());
    await userEvent.click(screen.getByRole("button", { name: /^upload$/i }));
    await waitFor(() => expect(signal).toBeDefined());

    view.unmount();

    expect(signal?.aborted).toBe(true);
  });
});
