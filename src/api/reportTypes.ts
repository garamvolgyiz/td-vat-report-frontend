export type SellerListResponse = {
  items: SellerListItemDto[];
};

export type SellerListItemDto = {
  id: string;
  name: string;
  taxNumber: string;
};

export type VatReportFilter = {
  sellerId: string;
  dateFrom: string;
  dateTo: string;
};

export type VatDeclarationReportResult = {
  header: VatDeclarationReportHeader;
  inbound: VatDeclarationReportRow[];
  outbound: VatDeclarationReportRow[];
};

export type VatDeclarationReportHeader = {
  sellerId: string;
  sellerName: string;
  dateFrom: string;
  dateTo: string;
};

export type VatDeclarationReportRow = {
  vatLevel: number;
  totalNetAmount: number;
  totalVatAmount: number;
  totalGrossAmount: number;
};

export type VatDeclarationReportErrorResponse = {
  errors: VatDeclarationReportError[];
};

export type VatDeclarationReportError = {
  field?: string | null;
  errorCode: string;
  message: string;
};

export type PageError = {
  title: string;
  errors: VatDeclarationReportError[];
};

export type PdfDownload = {
  blob: Blob;
  fileName: string;
};
