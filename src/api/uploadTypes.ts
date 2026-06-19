export type BulkInvoiceImportStatus = "completed" | "completed_with_errors" | "failed";

export type BulkInvoiceImportSummary = {
  totalInvoices: number;
  createdInvoices: number;
  skippedInvoices: number;
  failedInvoices: number;
  createdLines: number;
};

export type BulkInvoiceImportError = {
  scope: "file" | "invoice" | "line" | "seller" | "buyer" | "address" | "vat_rate";
  errorCode: string;
  message: string;
  path?: string | null;
  invoiceIndex?: number | null;
  lineIndex?: number | null;
  field?: string | null;
  sellerTaxNumber?: string | null;
  sellerName?: string | null;
  invoiceNumber?: string | null;
};

export type BulkInvoiceImportResponse = {
  importBatchId: string;
  fileName: string;
  status: BulkInvoiceImportStatus;
  summary: BulkInvoiceImportSummary;
  errors: BulkInvoiceImportError[];
};

export type UploadPageError = {
  title: string;
  errors: BulkInvoiceImportError[];
  correlationId?: string;
  canRetryWithSameKey?: boolean;
  result?: BulkInvoiceImportResponse;
};

export type UploadRequestMetadata = {
  idempotencyKey: string;
  correlationId: string;
};
