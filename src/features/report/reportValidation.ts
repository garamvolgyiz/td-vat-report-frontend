import type { VatDeclarationReportError, VatReportFilter } from "../../api/reportTypes";
import { isDateInputValue } from "./dateUtils";

export function validateReportFilter(filter: VatReportFilter): VatDeclarationReportError[] {
  const errors: VatDeclarationReportError[] = [];

  if (!filter.sellerId) {
    errors.push({ field: "sellerId", errorCode: "missing_required_field", message: "Seller is required." });
  }

  if (!filter.dateFrom) {
    errors.push({ field: "dateFrom", errorCode: "missing_required_field", message: "Date from is required." });
  } else if (!isDateInputValue(filter.dateFrom)) {
    errors.push({ field: "dateFrom", errorCode: "invalid_format", message: "Date from must use yyyy-MM-dd." });
  }

  if (!filter.dateTo) {
    errors.push({ field: "dateTo", errorCode: "missing_required_field", message: "Date to is required." });
  } else if (!isDateInputValue(filter.dateTo)) {
    errors.push({ field: "dateTo", errorCode: "invalid_format", message: "Date to must use yyyy-MM-dd." });
  }

  if (isDateInputValue(filter.dateFrom) && isDateInputValue(filter.dateTo) && filter.dateFrom > filter.dateTo) {
    errors.push({
      field: "dateFrom",
      errorCode: "invalid_range",
      message: "Date from must be before or equal to date to.",
    });
  }

  return errors;
}
