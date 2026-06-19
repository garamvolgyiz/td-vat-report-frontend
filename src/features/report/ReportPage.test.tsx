import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReportPage } from "./ReportPage";

const sellerId = "8c4e5d7c-5bb1-4af2-9a19-c4c8d1df7ce2";

describe("ReportPage", () => {
  beforeEach(() => {
    window.__RUNTIME_CONFIG__ = { apiBaseUrl: "https://api.example.test" };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads sellers, generates report, and marks result stale after filter edit", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/sellers")) {
        return Response.json({ items: [{ id: sellerId, name: "ABC Kft.", taxNumber: "12345678-2-42" }] });
      }

      if (url.includes("/api/v1/vat-declarations/report?")) {
        return Response.json({
          header: { sellerId, sellerName: "ABC Kft.", dateFrom: "2026-06-01", dateTo: "2026-06-30" },
          inbound: [{ vatLevel: 27, totalNetAmount: 1000, totalVatAmount: 270, totalGrossAmount: 1270 }],
          outbound: [],
        });
      }

      throw new Error(`Unhandled request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ReportPage />);

    await userEvent.selectOptions(await screen.findByLabelText(/seller/i), sellerId);
    await userEvent.click(screen.getByRole("button", { name: /generate/i }));

    expect(await screen.findByRole("heading", { name: "Report summary" })).toBeInTheDocument();
    expect(screen.getAllByText("ABC Kft.").length).toBeGreaterThan(0);
    expect(screen.getByText("1000,00")).toBeInTheDocument();
    expect(screen.getByText("No rows returned by the API.")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText(/date to/i));
    await userEvent.type(screen.getByLabelText(/date to/i), "2026-07-31");

    expect(await screen.findByText("Displayed report is stale")).toBeInTheDocument();
  });

  it("shows client validation errors before API report request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ items: [{ id: sellerId, name: "ABC Kft.", taxNumber: "12345678-2-42" }] })),
    );

    render(<ReportPage />);

    await waitFor(() => expect(screen.getByRole("button", { name: /generate/i })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() => expect(screen.getAllByText("Seller is required.").length).toBeGreaterThan(0));
    expect(screen.getByText("Report filter is invalid.")).toBeInTheDocument();
  });
});
