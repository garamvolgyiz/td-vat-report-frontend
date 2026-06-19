import { expect, test } from "@playwright/test";

test("uploads XML and renders import validation errors", async ({ page }) => {
  await page.route("**/api/v1/bulk-invoices/import", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    expect(request.headers()["idempotency-key"]).toBeTruthy();
    expect(request.headers()["x-correlation-id"]).toBeTruthy();
    expect(request.headers()["content-type"]).toContain("multipart/form-data");

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        importBatchId: "batch-e2e",
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
      }),
    });
  });

  await page.goto("/upload");
  await expect(page.getByRole("heading", { name: "XML upload" })).toBeVisible();

  await page.locator("#xml-file-input").setInputFiles({
    name: "invoices.xml",
    mimeType: "application/xml",
    buffer: Buffer.from("<Invoices />"),
  });
  await page.getByRole("button", { name: "Upload" }).click();

  await expect(page.getByRole("status").getByText("Import completed with errors")).toBeVisible();
  await expect(page.getByRole("region", { name: "Import summary" })).toContainText("Created invoices");
  await expect(page.getByRole("table", { name: "Invoice import validation errors" })).toContainText("invalid_vat_rate");
  await expect(page.getByRole("table", { name: "Invoice import validation errors" })).toContainText("INV-002");
});
