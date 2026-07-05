# Registration API

Public **Customer** and **Vendor** registration forms that write directly into
Microsoft Dynamics 365 Business Central — with no dependency on the Partner Portal.

Two standalone forms, each with its own URL, open to anyone. Submissions are
forwarded by this backend (which holds the BC credentials) to the **existing**
`partnerRegistrations` API (page 90123). The backend stamps `partnerType`
per form — the customer form always sends `Customer`, the vendor form always
sends `Vendor` — so no new BC objects are created.

## Architecture

```
[ Public browser ]              [ This backend ]                 [ Business Central ]
customer.html  ──POST /api/customer──▶  controller ──OAuth S2S──▶  partnerRegistrations (pg 90123)
vendor.html    ──POST /api/vendor────▶  + bcClient              ──▶  partnerType stamped by server
```

The browser never sees the BC credentials — only the server authenticates.
No new BC tables or pages: it reuses the partnerRegistrations API as-is.

## Folder structure

```
server.js                       Entry point
config/index.js                 All env vars + apiBase() builder
middleware/rateLimit.js         Per-IP rate limit on public endpoints
middleware/errorHandler.js      404 + central error handler
modules/bcClient.js             BC service: token, create, getById, update
modules/registrationMapper.js   Form -> BC field mapping + validation
controllers/registrationController.js   create / getOne / update (shared by both types)
routes/customerRoutes.js        Binds controller to 'customerRegistrations'
routes/vendorRoutes.js          Binds controller to 'vendorRegistrations'
routes/index.js                 Mounts routers under /api
public/                         customer.html, vendor.html, form.js
postman/                        Importable collection + environment
```

No AL objects are created — the backend targets the existing
`partnerRegistrations` API (page 90123) already published in BC.

## Endpoints

| Method | Route | Purpose |
| ------ | ----- | ------- |
| `POST`  | `/api/customer` · `/api/vendor` | Create a registration |
| `GET`   | `/api/customer/:regNo` · `/api/vendor/:regNo` | Read one (edit-page prefill) |
| `PATCH` | `/api/customer/:regNo` · `/api/vendor/:regNo` | Partial update |
| `GET`   | `/health` | Liveness check |

Forms: `/customer.html`, `/vendor.html`.
Edit an existing one: `/customer.html?regNo=PREG0001` (loads, then saves via PATCH).

## Configuration

All settings live in `.env` (copy from `.env.example`):

| Variable | Meaning |
| -------- | ------- |
| `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET` | Azure AD app (S2S / client credentials) |
| `BC_ENVIRONMENT` | BC environment name (e.g. `Delivery_App`) |
| `BC_COMPANY_ID` | BC company GUID |
| `BC_TOKEN_URL`, `BC_SCOPE` | Optional token overrides (derived if omitted) |
| `BC_API_HOST/PUBLISHER/GROUP/VERSION` | BC API location (defaults match pages 90137/90138) |
| `PORT` | HTTP port (default 3000) |

`.env` is gitignored; never commit real secrets.

## Setup

1. **Azure AD**: register an app, add a client secret, grant it BC
   `API.ReadWrite.All` (application permission) with admin consent.
2. **Business Central**: register that Client ID under *Microsoft Entra
   Applications*, enabled, with a permission set that can access the
   registration tables.
3. **Business Central**: in *Partner Portal Setup*, set **Partner Reg. Nos.**
   to a valid No. Series — the registration insert pulls its number from it.
   (Without this, POST fails with "Partner Registration Nos. must have a value".)
4. `cp .env.example .env` and fill in the values.

## Run

```bash
npm install
npm start        # or: npm run dev  (auto-reload)
```

Open http://localhost:3000/customer.html or /vendor.html.

## Testing

Import `postman/Partner Registration API.postman_collection.json` and the
matching environment, fill in the variables, run **Get OAuth Token** first,
then the create / read / update requests.
