import { describe, expect, it } from "vitest";
import { formatDateInput, getCurrentMonthRange, isDateInputValue } from "./dateUtils";

describe("dateUtils", () => {
  it("formats date input values in local yyyy-MM-dd shape", () => {
    expect(formatDateInput(new Date(2026, 5, 9))).toBe("2026-06-09");
  });

  it("returns first and last day of the current month", () => {
    expect(getCurrentMonthRange(new Date(2026, 5, 19))).toEqual({
      dateFrom: "2026-06-01",
      dateTo: "2026-06-30",
    });
  });

  it("checks browser date input format", () => {
    expect(isDateInputValue("2026-06-19")).toBe(true);
    expect(isDateInputValue("19/06/2026")).toBe(false);
  });
});
