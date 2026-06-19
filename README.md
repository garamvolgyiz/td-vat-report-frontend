# td-vat-report-frontend

React TypeScript admin frontend for VAT reporting.

## Implemented Pages

- `/upload` - XML VAT declaration upload, multipart import request, idempotency/correlation headers, import summary, and backend validation errors.
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

- `POST /api/v1/bulk-invoices/import`
- `GET /api/v1/sellers`
- `GET /api/v1/vat-declarations/report`
- `GET /api/v1/vat-declarations/report/pdf`

## Docker

The Docker image builds the Vite app and serves it with nginx. Runtime API
settings are generated into `runtime-config.js` when the container starts.

Production `.env` example:

```bash
FRONTEND_PORT=3000
API_PROTOCOL=https
API_HOST=api.garamol.com
API_PORT=
API_BASE_URL=
```

Run:

```bash
docker compose up -d --build
```

The compose file uses container name `app` and joins the external `proxy-net`
network for reverse proxy routing to `https://app.garamol.com`.

## Development

```bash
npm install
npm run dev
```

Local app URLs:

- `http://127.0.0.1:3000/upload`
- `http://127.0.0.1:3000/report`

## Verification

```bash
npm run build
npm run test
npm run test:e2e
```

Unit tests cover date defaults, filter validation, report page behavior, upload validation, upload success, backend import errors, network retry state, and unmount abort behavior.
API contract tests verify endpoint paths, query parameters, multipart field names, idempotency/correlation headers, backend error parsing, PDF filename handling, and upload response enums.
E2E tests cover the report generation/PDF workflow and the XML upload/import workflow with mocked API responses.
