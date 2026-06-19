import { expect, test } from "@playwright/test";

const sellerId = "8c4e5d7c-5bb1-4af2-9a19-c4c8d1df7ce2";

test("generates VAT report and downloads PDF with same filter", async ({ page }) => {
  await page.route("**/api/v1/sellers", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ items: [{ id: sellerId, name: "ABC Kft.", taxNumber: "12345678-2-42" }] }),
    });
  });

  await page.route("**/api/v1/vat-declarations/report?**", async (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get("sellerId")).toBe(sellerId);
    expect(url.searchParams.get("dateFrom")).toBe("2026-06-01");
    expect(url.searchParams.get("dateTo")).toBe("2026-06-30");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        header: { sellerId, sellerName: "ABC Kft.", dateFrom: "2026-06-01", dateTo: "2026-06-30" },
        inbound: [{ vatLevel: 27, totalNetAmount: 1000, totalVatAmount: 270, totalGrossAmount: 1270 }],
        outbound: [{ vatLevel: 5, totalNetAmount: 500, totalVatAmount: 25, totalGrossAmount: 525 }],
      }),
    });
  });

  await page.route("**/api/v1/vat-declarations/report/pdf?**", async (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get("sellerId")).toBe(sellerId);
    expect(url.searchParams.get("dateFrom")).toBe("2026-06-01");
    expect(url.searchParams.get("dateTo")).toBe("2026-06-30");
    await route.fulfill({
      contentType: "application/pdf",
      headers: { "content-disposition": 'attachment; filename="vat-declaration-report.pdf"' },
      body: Buffer.from("%PDF-1.4\n"),
    });
  });

  await page.goto("/report");
  await expect(page.getByRole("heading", { name: "VAT declaration" })).toBeVisible();

  await page.getByLabel("Seller *").selectOption(sellerId);
  await page.getByLabel("Date from *").fill("2026-06-01");
  await page.getByLabel("Date to *").fill("2026-06-30");
  await page.getByRole("button", { name: "Generate" }).click();

  const summary = page.getByRole("region", { name: "Report summary" });
  await expect(summary.getByRole("heading", { name: "Report summary" })).toBeVisible();
  await expect(summary.getByText("ABC Kft.").first()).toBeVisible();
  await expect(page.getByRole("table", { name: "Incoming invoices VAT declaration rows" })).toContainText("1000,00");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("vat-declaration-report.pdf");
});
