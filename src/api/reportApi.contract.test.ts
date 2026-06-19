import { describe, expect, it, vi } from "vitest";
import { createReportApi, ReportApiError } from "./reportApi";

const filter = {
  sellerId: "8c4e5d7c-5bb1-4af2-9a19-c4c8d1df7ce2",
  dateFrom: "2026-06-01",
  dateTo: "2026-06-30",
};

describe("report API contract", () => {
  it("calls seller list endpoint", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      Response.json({
        items: [{ id: filter.sellerId, name: "ABC Kft.", taxNumber: "12345678-2-42" }],
      }),
    );
    const api = createReportApi({ apiBaseUrl: "https://api.example.test", fetchFn });

    await expect(api.listSellers()).resolves.toEqual({
      items: [{ id: filter.sellerId, name: "ABC Kft.", taxNumber: "12345678-2-42" }],
    });
    expect(fetchFn).toHaveBeenCalledWith("https://api.example.test/api/v1/sellers");
  });

  it("sends report query parameters and returns report body", async () => {
    const responseBody = {
      header: { sellerId: filter.sellerId, sellerName: "ABC Kft.", dateFrom: "2026-06-01", dateTo: "2026-06-30" },
      inbound: [],
      outbound: [],
    };
    const fetchFn = vi.fn().mockResolvedValue(Response.json(responseBody));
    const api = createReportApi({ apiBaseUrl: "https://api.example.test", fetchFn });

    await expect(api.getReport(filter)).resolves.toEqual(responseBody);

    const calledUrl = new URL(fetchFn.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe("/api/v1/vat-declarations/report");
    expect(calledUrl.searchParams.get("sellerId")).toBe(filter.sellerId);
    expect(calledUrl.searchParams.get("dateFrom")).toBe("2026-06-01");
    expect(calledUrl.searchParams.get("dateTo")).toBe("2026-06-30");
  });

  it("preserves backend validation errors", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      Response.json(
        {
          errors: [{ field: "sellerId", errorCode: "invalid_format", message: "Seller id must be a valid GUID." }],
        },
        { status: 400 },
      ),
    );
    const api = createReportApi({ apiBaseUrl: "https://api.example.test", fetchFn });

    const expectedError: Partial<ReportApiError> = {
      pageError: {
        title: "Report filter is invalid.",
        errors: [{ field: "sellerId", errorCode: "invalid_format", message: "Seller id must be a valid GUID." }],
      },
    };

    await expect(api.getReport(filter)).rejects.toMatchObject(expectedError);
  });

  it("downloads PDF blob and content-disposition filename", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(new Blob(["pdf"], { type: "application/pdf" }), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": 'attachment; filename="custom-report.pdf"',
        },
      }),
    );
    const api = createReportApi({ apiBaseUrl: "https://api.example.test", fetchFn });

    await expect(api.downloadPdf(filter)).resolves.toMatchObject({
      fileName: "custom-report.pdf",
    });

    const calledUrl = new URL(fetchFn.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe("/api/v1/vat-declarations/report/pdf");
  });
});
