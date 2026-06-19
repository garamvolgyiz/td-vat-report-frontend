import { describe, expect, it } from "vitest";
import { validateReportFilter } from "./reportValidation";

describe("validateReportFilter", () => {
  it("requires seller and dates", () => {
    const errors = validateReportFilter({ sellerId: "", dateFrom: "", dateTo: "" });

    expect(errors.map((error) => error.field)).toEqual(["sellerId", "dateFrom", "dateTo"]);
  });

  it("rejects invalid date range", () => {
    const errors = validateReportFilter({
      sellerId: "8c4e5d7c-5bb1-4af2-9a19-c4c8d1df7ce2",
      dateFrom: "2026-06-30",
      dateTo: "2026-06-01",
    });

    expect(errors).toContainEqual({
      field: "dateFrom",
      errorCode: "invalid_range",
      message: "Date from must be before or equal to date to.",
    });
  });

  it("accepts valid filter", () => {
    expect(
      validateReportFilter({
        sellerId: "8c4e5d7c-5bb1-4af2-9a19-c4c8d1df7ce2",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
      }),
    ).toEqual([]);
  });
});
