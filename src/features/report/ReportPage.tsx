import { FormEvent, useEffect, useMemo, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { asPageError, createReportApi } from "../../api/reportApi";
import type {
  PageError,
  SellerListItemDto,
  VatDeclarationReportError,
  VatDeclarationReportResult,
  VatDeclarationReportRow,
  VatReportFilter,
} from "../../api/reportTypes";
import { AdminPageLayout } from "../../components/AdminShell";
import { getRuntimeConfig } from "../../lib/runtimeConfig";
import { getCurrentMonthRange } from "./dateUtils";
import { validateReportFilter } from "./reportValidation";

type SellersState =
  | { status: "loading" }
  | { status: "loaded"; items: SellerListItemDto[] }
  | { status: "failed"; error: PageError };

type ReportState =
  | { status: "idle" }
  | { status: "loading"; filter: VatReportFilter }
  | {
      status: "loaded";
      filter: VatReportFilter;
      result: VatDeclarationReportResult;
      isStale: boolean;
    }
  | { status: "failed"; filter?: VatReportFilter; error: PageError };

type PdfState = { status: "idle" } | { status: "loading" } | { status: "failed"; error: PageError };

const moneyFormatter = new Intl.NumberFormat("hu-HU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const vatFormatter = new Intl.NumberFormat("hu-HU", {
  maximumFractionDigits: 4,
});

function sameFilter(left: VatReportFilter, right: VatReportFilter): boolean {
  return left.sellerId === right.sellerId && left.dateFrom === right.dateFrom && left.dateTo === right.dateTo;
}

function initialFilter(now = new Date()): VatReportFilter {
  const range = getCurrentMonthRange(now);
  return {
    sellerId: "",
    ...range,
  };
}

export function ReportPage() {
  const api = useMemo(() => createReportApi({ apiBaseUrl: getRuntimeConfig().apiBaseUrl }), []);
  const [filter, setFilter] = useState<VatReportFilter>(() => initialFilter());
  const [sellersState, setSellersState] = useState<SellersState>({ status: "loading" });
  const [reportState, setReportState] = useState<ReportState>({ status: "idle" });
  const [validationErrors, setValidationErrors] = useState<VatDeclarationReportError[]>([]);
  const [pdfState, setPdfState] = useState<PdfState>({ status: "idle" });

  async function loadSellers() {
    setSellersState({ status: "loading" });
    try {
      const response = await api.listSellers();
      setSellersState({ status: "loaded", items: response.items });
    } catch (error) {
      setSellersState({ status: "failed", error: asPageError(error) });
    }
  }

  useEffect(() => {
    void loadSellers();
  }, []);

  const reportView =
    reportState.status === "loaded" ? { ...reportState, isStale: !sameFilter(reportState.filter, filter) } : reportState;

  const selectedSeller =
    sellersState.status === "loaded" ? sellersState.items.find((seller) => seller.id === filter.sellerId) : undefined;

  const canSubmit = sellersState.status === "loaded" && sellersState.items.length > 0 && reportState.status !== "loading";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPdfState({ status: "idle" });

    const errors = validateReportFilter(filter);
    setValidationErrors(errors);
    if (errors.length > 0) {
      setReportState({
        status: "failed",
        error: { title: "Report filter is invalid.", errors },
      });
      return;
    }

    const submittedFilter = { ...filter };
    setReportState({ status: "loading", filter: submittedFilter });
    try {
      const result = await api.getReport(submittedFilter);
      setReportState({ status: "loaded", filter: submittedFilter, result, isStale: false });
    } catch (error) {
      setReportState({ status: "failed", filter: submittedFilter, error: asPageError(error) });
    }
  }

  async function handleDownloadPdf() {
    if (reportView.status !== "loaded") {
      return;
    }

    setPdfState({ status: "loading" });
    try {
      const download = await api.downloadPdf(reportView.filter);
      const url = URL.createObjectURL(download.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = download.fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setPdfState({ status: "idle" });
    } catch (error) {
      setPdfState({ status: "failed", error: asPageError(error) });
    }
  }

  return (
    <AdminPageLayout
      title="VAT declaration"
      description="Generate one seller report for an inclusive issue-date period."
      actions={
        sellersState.status === "failed" ? (
          <button className="button secondary" type="button" onClick={loadSellers}>
            <RefreshCw aria-hidden="true" size={16} />
            Refresh sellers
          </button>
        ) : null
      }
    >
      <section className="panel" aria-labelledby="report-filter-heading">
        <div className="panel-heading">
          <div>
            <h2 id="report-filter-heading">Report filter</h2>
            <p>Select seller and report period.</p>
          </div>
        </div>

        {sellersState.status === "failed" ? <ReportErrorAlert error={sellersState.error} /> : null}
        {sellersState.status === "loaded" && sellersState.items.length === 0 ? (
          <Alert variant="info" title="No sellers found">
            Import invoices before generating a VAT declaration report.
          </Alert>
        ) : null}

        <ReportFilterForm
          filter={filter}
          sellersState={sellersState}
          selectedSeller={selectedSeller}
          validationErrors={validationErrors}
          canSubmit={canSubmit}
          isBusy={reportState.status === "loading"}
          onChange={setFilter}
          onSubmit={handleSubmit}
        />
      </section>

      {reportState.status === "failed" ? <ReportErrorAlert error={reportState.error} /> : null}
      {pdfState.status === "failed" ? <ReportErrorAlert error={pdfState.error} /> : null}
      {reportView.status === "loading" ? <Alert variant="info" title="Generating report">Report request in progress.</Alert> : null}

      {reportView.status === "loaded" ? (
        <>
          {reportView.isStale ? (
            <Alert variant="warning" title="Displayed report is stale">
              Generate again to update results for the current filter values.
            </Alert>
          ) : null}
          <VatReportSummary result={reportView.result} />
          <section className="panel" aria-labelledby="report-details-heading">
            <div className="panel-heading report-details-heading">
              <div>
                <h2 id="report-details-heading">Report details</h2>
                <p>Values come from the API response without client recalculation.</p>
              </div>
              <DownloadPdfButton isBusy={pdfState.status === "loading"} onClick={handleDownloadPdf} />
            </div>
            <VatReportTable title="Incoming invoices" rows={reportView.result.inbound} />
            <VatReportTable title="Outgoing invoices" rows={reportView.result.outbound} />
          </section>
        </>
      ) : null}
    </AdminPageLayout>
  );
}

type ReportFilterFormProps = {
  filter: VatReportFilter;
  sellersState: SellersState;
  selectedSeller?: SellerListItemDto;
  validationErrors: VatDeclarationReportError[];
  canSubmit: boolean;
  isBusy: boolean;
  onChange: (filter: VatReportFilter) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function ReportFilterForm({
  filter,
  sellersState,
  selectedSeller,
  validationErrors,
  canSubmit,
  isBusy,
  onChange,
  onSubmit,
}: ReportFilterFormProps) {
  const fieldError = (field: string) => validationErrors.find((error) => error.field === field);

  return (
    <form className="filter-form" onSubmit={onSubmit} noValidate>
      <div className="field seller-field">
        <label htmlFor="sellerId">
          Seller <span aria-hidden="true">*</span>
        </label>
        <select
          id="sellerId"
          name="sellerId"
          value={filter.sellerId}
          disabled={sellersState.status !== "loaded" || sellersState.items.length === 0 || isBusy}
          aria-describedby="seller-help seller-error"
          onChange={(event) => onChange({ ...filter, sellerId: event.currentTarget.value })}
        >
          <option value="">{sellersState.status === "loading" ? "Loading sellers..." : "Select seller"}</option>
          {sellersState.status === "loaded"
            ? sellersState.items.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.name} - {seller.taxNumber}
                </option>
              ))
            : null}
        </select>
        <p id="seller-help" className="field-help">
          {selectedSeller ? selectedSeller.taxNumber : "Seller name and tax number identify the report owner."}
        </p>
        {fieldError("sellerId") ? (
          <p id="seller-error" className="field-error">
            {fieldError("sellerId")?.message}
          </p>
        ) : null}
      </div>

      <DateField
        id="dateFrom"
        label="Date from"
        value={filter.dateFrom}
        error={fieldError("dateFrom")}
        disabled={isBusy}
        onChange={(value) => onChange({ ...filter, dateFrom: value })}
      />
      <DateField
        id="dateTo"
        label="Date to"
        value={filter.dateTo}
        error={fieldError("dateTo")}
        disabled={isBusy}
        onChange={(value) => onChange({ ...filter, dateTo: value })}
      />

      <div className="form-actions">
        <button className="button primary" type="submit" disabled={!canSubmit} aria-busy={isBusy}>
          {isBusy ? <Loader2 className="spin" aria-hidden="true" size={16} /> : null}
          Generate
        </button>
      </div>
    </form>
  );
}

type DateFieldProps = {
  id: "dateFrom" | "dateTo";
  label: string;
  value: string;
  error?: VatDeclarationReportError;
  disabled: boolean;
  onChange: (value: string) => void;
};

function DateField({ id, label, value, error, disabled, onChange }: DateFieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label} <span aria-hidden="true">*</span>
      </label>
      <input
        id={id}
        name={id}
        type="date"
        value={value}
        disabled={disabled}
        aria-describedby={`${id}-help ${id}-error`}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <p id={`${id}-help`} className="field-help">
        yyyy-MM-dd
      </p>
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}

function VatReportSummary({ result }: { result: VatDeclarationReportResult }) {
  return (
    <section className="panel" aria-labelledby="summary-heading">
      <div className="panel-heading">
        <div>
          <h2 id="summary-heading">Report summary</h2>
          <p>{result.header.sellerName}</p>
        </div>
      </div>
      <dl className="summary-grid">
        <div>
          <dt>Seller</dt>
          <dd>{result.header.sellerName}</dd>
        </div>
        <div>
          <dt>Period</dt>
          <dd>
            {result.header.dateFrom} to {result.header.dateTo}
          </dd>
        </div>
        <div>
          <dt>Incoming VAT rows</dt>
          <dd>{result.inbound.length}</dd>
        </div>
        <div>
          <dt>Outgoing VAT rows</dt>
          <dd>{result.outbound.length}</dd>
        </div>
      </dl>
    </section>
  );
}

function VatReportTable({ title, rows }: { title: string; rows: VatDeclarationReportRow[] }) {
  return (
    <div className="table-wrap">
      <h3>{title}</h3>
      <div className="table-scroll">
        <table>
          <caption>{title} VAT declaration rows</caption>
          <thead>
            <tr>
              <th scope="col">VAT level</th>
              <th scope="col" className="numeric">
                Total net amount
              </th>
              <th scope="col" className="numeric">
                Total VAT amount
              </th>
              <th scope="col" className="numeric">
                Total gross amount
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-cell">
                  No rows returned by the API.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.vatLevel}>
                  <td>{vatFormatter.format(row.vatLevel)}%</td>
                  <td className="numeric">{moneyFormatter.format(row.totalNetAmount)}</td>
                  <td className="numeric">{moneyFormatter.format(row.totalVatAmount)}</td>
                  <td className="numeric">{moneyFormatter.format(row.totalGrossAmount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DownloadPdfButton({ isBusy, onClick }: { isBusy: boolean; onClick: () => void }) {
  return (
    <button className="button secondary" type="button" onClick={onClick} disabled={isBusy} aria-busy={isBusy}>
      {isBusy ? <Loader2 className="spin" aria-hidden="true" size={16} /> : <Download aria-hidden="true" size={16} />}
      Download PDF
    </button>
  );
}

function ReportErrorAlert({ error }: { error: PageError }) {
  return (
    <Alert variant="danger" title={error.title}>
      <ul className="error-list">
        {error.errors.map((item, index) => (
          <li key={`${item.errorCode}-${item.field ?? "page"}-${index}`}>
            <code>{item.errorCode}</code>
            {item.field ? <span className="error-field">{item.field}</span> : null}
            <span>{item.message}</span>
          </li>
        ))}
      </ul>
    </Alert>
  );
}

function Alert({
  variant,
  title,
  children,
}: {
  variant: "success" | "warning" | "danger" | "info";
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`alert ${variant}`} role={variant === "danger" ? "alert" : "status"}>
      <strong>{title}</strong>
      {children ? <div className="alert-body">{children}</div> : null}
    </div>
  );
}
