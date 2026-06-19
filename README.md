# td-vat-report-frontend

React TypeScript admin frontend for VAT reporting.

## Implemented Pages

- `/report` - seller selector, inclusive date range filter, JSON VAT declaration report tables, stale-result warning, and PDF download.

## Environment

The app reads API settings from `.env` through Vite `VITE_*` variables:

```bash
VITE_API_PROTOCOL=http
VITE_API_HOST=127.0.0.1
VITE_API_PORT=5003
VITE_API_BASE_URL=http://127.0.0.1:5003
```

`public/runtime-config.js` can still provide deployment defaults, but `.env`
values take precedence during Vite build/dev:

```js
window.__RUNTIME_CONFIG__ = {
  apiProtocol: "http",
  apiHost: "127.0.0.1",
  apiPort: "5003",
  apiBaseUrl: "http://127.0.0.1:5003"
};
```

`apiBaseUrl` is used for:

- `GET /api/v1/sellers`
- `GET /api/v1/vat-declarations/report`
- `GET /api/v1/vat-declarations/report/pdf`

## Development

```bash
npm install
npm run dev
```

Local app URL: `http://127.0.0.1:3000/report`

## Verification

```bash
npm run build
npm run test
npm run test:e2e
```

Unit tests cover date defaults, filter validation, and report page behavior.
API contract tests verify endpoint paths, query parameters, backend error parsing, and PDF filename handling.
E2E tests cover the report generation and PDF download workflow with mocked API responses.
