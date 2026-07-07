# Partner Portal – Registration API — Project Overview

> Public **Customer** and **Vendor** registration portal that writes submissions
> **directly into Microsoft Dynamics 365 Business Central (BC)**. The browser
> never sees BC credentials — this Node/Express backend holds the OAuth secret
> and forwards each registration to the existing `partnerPortal` BC API.

- **Live site:** `https://registration-api-g1us.onrender.com` (hosted on Render)
- **Repo:** `github.com/lavanya991-11/registration-api` (branch `main`)
- **Runtime:** Node.js + Express 5
- **BC target:** custom API pages/codeunits published under the `partnerPortal` API group

---

## 1. What this project does

It publishes two open, standalone web forms — a **Customer Registration** form
and a **Vendor Registration** form — that anyone can fill in without a login.
When a form is submitted, the backend authenticates to Business Central using an
Azure AD service-to-service token and creates a *partner registration* record
(header + contact lines + bank lines + file attachments) inside BC.

Key design decisions:

- **No new BC objects for the core flow** — it reuses the existing
  `partnerRegistrations` API page and the `PP Public Reg. Intake` codeunit.
- **`partnerType` is stamped server-side** — the customer form always sends
  `Customer`, the vendor form always sends `Vendor`. The browser cannot spoof it.
- **Credentials stay on the server** — only the backend calls BC; the front-end
  only talks to this backend's `/api/*` routes.

---

## 2. Architecture & data flow

```
   PUBLIC BROWSER                    THIS BACKEND (Node/Express)              BUSINESS CENTRAL
 ┌────────────────┐   POST /api/customer   ┌──────────────────────┐   OAuth S2S    ┌────────────────────┐
 │ customer.html  │ ─────────────────────▶ │ registrationController │ ───token───▶ │ Azure AD (login)   │
 │ vendor.html    │   POST /api/vendor     │  + registrationMapper  │              └────────────────────┘
 │  form.js       │ ─────────────────────▶ │  + bcClient            │   REST/OData   ┌────────────────────┐
 │  wizard.js     │                        │                        │ ───────────▶ │ partnerPortal API   │
 │  options.js    │ ◀───{success, regNo}── │  rateLimit, errorHandler│ ◀─────────── │  · publicRegIntake  │
 └────────────────┘                        └──────────────────────┘               │  · partnerRegistr.  │
                                                                                    └────────────────────┘
```

**Happy-path submission:**

1. User completes the wizard (`customer.html` / `vendor.html`) and clicks **Submit**.
2. `form.js` gathers the header fields, contact lines, bank lines, and base64
   attachments into one JSON body and `POST`s it to `/api/customer` (or `/api/vendor`).
3. `registrationController.create` validates the body, then calls
   `bcClient.submitRegistration()`.
4. `bcClient` fetches (and caches) an Azure AD token, then invokes the BC bound
   action `publicRegIntake('<seed>')/Microsoft.NAV.submit` with the whole
   registration as a JSON payload. BC creates the header, child lines, and decodes
   attachments into the Document Attachment table in one call.
5. The controller returns `{ success: true, regNo, message }`; `form.js` shows the
   green confirmation and resets the form.

---

## 3. Tech stack

| Layer        | Technology                                             |
| ------------ | ------------------------------------------------------ |
| Server       | Node.js, Express 5                                     |
| HTTP client  | axios (BC REST/OData calls)                            |
| Auth to BC   | Azure AD client-credentials (OAuth 2.0), `dotenv` config |
| Front-end    | Vanilla HTML/CSS/JS (no framework, no build step)      |
| Hosting      | Render (Blueprint via `render.yaml`), auto-deploy on push |
| API testing  | Postman collection in `postman/`                       |

---

## 4. Folder structure

```
registration-api/
├── server.js                     Express app: middleware, static files, routes, listen
├── render.yaml                   Render Blueprint (build/start + env var declarations)
├── package.json                  Scripts (start / dev) + dependencies
├── .env / .env.example           Secrets & BC location (gitignored / template)
│
├── config/
│   └── index.js                  Reads ALL env vars; builds config.bc.apiBase()
│
├── middleware/
│   ├── rateLimit.js              In-memory per-IP limiter (10 req/min) on public routes
│   └── errorHandler.js           404 handler + central error handler ({success,errorCode,message})
│
├── modules/
│   ├── bcClient.js               BC service layer: token cache + create/read/update/action + meta lists
│   └── registrationMapper.js     Request→BC field mapping, regNo generation, validation
│
├── controllers/
│   └── registrationController.js create / getOne / submit / update — shared by Customer & Vendor
│
├── routes/
│   ├── index.js                  Mounts all routers under /api
│   ├── customerRoutes.js         Binds controller with partnerType='Customer'
│   ├── vendorRoutes.js           Binds controller with partnerType='Vendor'
│   ├── registrationRoutes.js     Unified endpoint; partnerType read from body / BC-link (docNo) flow
│   └── metaRoutes.js             Dropdown data: post codes, payment methods, payment terms (1h cache)
│
├── public/                       Static front-end (served by express.static, no-cache)
│   ├── index.html                Landing page: choose Customer or Vendor
│   ├── customer.html             Customer form  (SUBMIT_URL=/api/customer)
│   ├── vendor.html               Vendor form    (SUBMIT_URL=/api/vendor)
│   ├── register.html             BC-link edit form (REQUIRE_DOC; opened via ?docNo=)
│   ├── form.js                   Shared form logic: collect, submit, edit-mode, attachments
│   ├── wizard.js                 Turns the form into a 4-step wizard (Company/Contacts/Bank/Attach)
│   ├── options.js                Fills static <select> lists (country, currency, entity, category)
│   ├── form.css / styles.css     Styling
│
├── postman/                      Importable collection + environment for API testing
└── docs/
    └── PROJECT_OVERVIEW.md       ← this document
```

---

## 5. Backend modules in detail

### `config/index.js`
Single source of truth for environment values. Nothing else reads `process.env`.
Exposes `config.bc.apiBase()` which builds the BC company-scoped API root:
```
https://{BC_API_HOST}/v2.0/{BC_ENVIRONMENT}/api/{PUBLISHER}/{GROUP}/{VERSION}/companies({BC_COMPANY_ID})
```

### `modules/bcClient.js`
The only file that talks to Business Central. Responsibilities:
- **`getToken()`** — client-credentials OAuth token, cached until ~60 s before expiry.
- **`create / getById / update / invokeAction`** — generic REST/OData helpers.
  `getById` uses `$filter=regNo eq '…'` (safe for the code-key page).
  `update` sends `If-Match: *` (BC requires it on PATCH).
- **`submitRegistration()`** — the preferred path. Calls the
  `publicRegIntake('<seed>')/Microsoft.NAV.submit` codeunit action with the full
  registration (header + contacts + banks + attachments) as one JSON payload.
  It needs a "seed" regNo (any existing registration) to bind the action to;
  the seed is cached and refetched if it goes stale.
- **`listPostCodes / listPaymentMethods / listPaymentTerms`** — reference data for
  the form dropdowns.

### `modules/registrationMapper.js`
Translates the public request contract into BC field names and validates it.
- Accepts either a **nested** body (`{ header, contactLines, bankLines }`) or a
  flat body (fields at top level) — see `getHeader()`.
- `HEADER_FIELDS`, `CONTACT_FIELDS`, `BANK_FIELDS` whitelist exactly which fields
  are forwarded to BC (`pick()` drops empties).
- `validate()` enforces: trade name (≥2 chars), a valid partner email, a
  country/region code, and valid contact-line emails.
- `newRegNo(prefix)` generates a short unique `Code[20]` reg number when
  `GENERATE_REG_NO=true` (used only in the fallback flow).

### `controllers/registrationController.js`
`createController(partnerType)` returns the four handlers. `create` implements a
**two-tier strategy**:
1. **Preferred:** `bcClient.submitRegistration()` → the `publicRegIntake` codeunit
   (creates header + lines + attachments in one shot).
2. **Fallback:** if the codeunit call throws, it creates the header via the
   `partnerRegistrations` entity, then pushes contacts/banks through the
   `updateRegistration` bound action (no attachments in this mode). This keeps the
   portal working even if the No. Series / codeunit isn't aligned yet.

All errors are normalized by `handleBcError` into the
`{ success, errorCode, message }` contract (e.g. `EMAIL_ALREADY_USED`,
`BC_VALIDATION`, `NOT_FOUND`, `BC_ERROR`).

### `middleware/`
- **`rateLimit.js`** — in-memory `Map` of IP → count; 10 requests per 60 s window,
  returns `429 RATE_LIMITED` when exceeded. (Resets on restart; no external store.)
- **`errorHandler.js`** — `notFound` for unknown routes, and a catch-all
  `errorHandler` returning `500 INTERNAL_ERROR`.

---

## 6. API reference

Base path: `/api`. All responses follow `{ success, errorCode?, message?, … }`.
All public routes are rate-limited (10/min/IP).

| Method | Route | Purpose |
| ------ | ----- | ------- |
| `POST`  | `/api/customer` | Create a **Customer** registration |
| `POST`  | `/api/vendor` | Create a **Vendor** registration |
| `POST`  | `/api/registration` | Unified create (`partnerType` in body) |
| `GET`   | `/api/customer/:regNo` · `/api/vendor/:regNo` | Read one (edit-page prefill) |
| `PATCH` | `/api/customer/:regNo` · `/api/vendor/:regNo` | Partial header update |
| `POST`  | `/api/{type}/:docNo/submit` | Invoke BC `updateRegistration` (BC-link flow) |
| `GET`   | `/api/meta/postcodes?country=AE` | Post codes for the dropdown (1 h cache) |
| `GET`   | `/api/meta/payment-methods` · `/api/meta/payment-terms` | Reference lists (1 h cache) |
| `GET`   | `/health` | Liveness check → `{ ok: true }` |

**Static pages:** `/` (chooser), `/customer.html`, `/vendor.html`,
`/register.html?docNo=PRG-000001` (edit an existing record from a BC link).

### Example: create request body (nested)
```json
{
  "header": {
    "tradeName": "Acme Trading LLC",
    "partnerEmail": "info@acme.example",
    "countryRegionCode": "AE",
    "vatRegistrationNo": "100123456700003",
    "currencyCode": "AED",
    "postCode": "00000",
    "city": "Dubai"
  },
  "contactLines": [
    { "fullName": "Sara Ali", "designation": "Finance", "emailAddress": "sara@acme.example" }
  ],
  "bankLines": [
    { "name": "Emirates NBD", "iban": "AE00...", "swiftCode": "EBILAEAD", "isPrimary": true }
  ],
  "attachments": [
    { "fileName": "trade-license.pdf", "base64": "JVBERi0..." }
  ]
}
```

### Example: success response
```json
{
  "success": true,
  "regNo": "PRG-000011",
  "status": "Draft",
  "message": "Registration received. You will hear from us shortly.",
  "attachmentsSaved": 1,
  "attachmentsSkipped": 0
}
```

---

## 7. Front-end (public/)

- **`options.js`** fills the static dropdowns (country, currency, entity type,
  partner category). Post codes / payment terms / methods are loaded live from
  `/api/meta/*`.
- **`wizard.js`** progressively enhances the form into a 4-step wizard
  (Company Details → Contacts → Bank Accounts → Attachments) with a clickable
  stepper and per-step required-field validation. All fields stay in the DOM, so
  the single submit still sends everything.
- **`form.js`** is the core:
  - **Create mode** (plain URL): collects header + lines + attachments (files read
    as base64, max 5 MB each) and `POST`s the nested body.
  - **Edit mode** (`?regNo=` / `?docNo=`): `GET`s the record, prefills the header,
    and saves via `PATCH` or the `/submit` action.
  - On success it shows the confirmation message and resets the form.
    *(Note: the old behavior of auto-downloading a `publicRegIntake-*.json` file on
    submit was intentionally removed.)*

> **Cache-busting:** the HTML pages reference `form.js?v=2`. Bump this query
> (`?v=3`, …) whenever `form.js` changes so browsers fetch the new file instead of
> a cached copy.

---

## 8. Data model — request → BC field mapping

**Header** (`partnerRegistrations`): `tradeName`, `partnerEmail`,
`tradeLicenseNumber`, `tradeLicenseExpiryDate`, `companyRegNumber`, `entityType`,
`countryOfIncorporation`, `placeOfRegistration`, `website`, `phoneNo`, `address`,
`address2`, `city`, `postCode`, `countryRegionCode`, `vatRegistrationNo`,
`currencyCode`, `paymentMethodCode`, `paymentTermsCode`, `partnerCategory`.

**Contact line:** `fullName`, `designation`, `mobileNumber`, `emailAddress`.

**Bank line:** `bankCode`, `name`, `bankBranchNo`, `bankAccountNo`, `iban`,
`swiftCode`, `currencyCode`, `isPrimary`.

`regType` is forced to `Create` and `partnerType` is stamped by the server on
create; only whitelisted, non-empty fields are forwarded.

---

## 9. Configuration (environment variables)

Set in `.env` locally (copy from `.env.example`); on Render they're set in the
dashboard (`sync: false` secrets are prompted, never stored in git).

| Variable | Meaning |
| -------- | ------- |
| `TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET` | Azure AD app (client-credentials) |
| `BC_ENVIRONMENT` | BC environment name |
| `BC_COMPANY_ID` | BC company GUID |
| `BC_TOKEN_URL`, `BC_SCOPE` | Token overrides (derived from tenant if omitted) |
| `BC_API_HOST` / `PUBLISHER` / `GROUP` / `VERSION` | BC API location (defaults: `partnerPortal` / `v2.0`) |
| `GENERATE_REG_NO` | `true` = backend generates regNo; `false` = BC No. Series assigns it |
| `REG_NO_PREFIX` | Prefix for generated reg numbers (default `WEB`) |
| `PORT` | HTTP port (host-provided in prod; `3000` locally) |

---

## 10. Local development

```bash
cd registration-api
cp .env.example .env      # fill in Azure AD + BC values
npm install
npm start                 # or: npm run dev   (node --watch auto-reload)
```
Open `http://localhost:3000/` and pick Customer or Vendor.

**Prerequisites in Azure/BC** (one-time):
1. Register an Azure AD app, add a client secret, grant BC `API.ReadWrite.All`
   (application permission) with admin consent.
2. In BC, register that Client ID under *Microsoft Entra Applications* with a
   permission set that can access the registration tables.
3. In *Partner Portal Setup*, set **Partner Reg. Nos.** to a valid No. Series
   (unless using `GENERATE_REG_NO=true`).

---

## 11. Deployment (Render)

- The site is a Render **web service** defined by `render.yaml`
  (`buildCommand: npm install`, `startCommand: npm start`).
- **Auto-deploy:** pushing to the `main` branch of the GitHub repo triggers a
  rebuild and redeploy. Local file edits do **not** affect the live site until
  they are committed and pushed.
- Watch the Render dashboard → service → **Events / Logs** until it shows
  **"Deploy live"**, then hard-refresh the browser (Ctrl+Shift+R).

**Deploy checklist:**
```bash
cd registration-api
git add -A
git commit -m "…"
git push origin main        # Render redeploys automatically
```

---

## 12. Security notes

- BC credentials live only on the server (env vars); the browser only reaches
  `/api/*`. Never expose `CLIENT_SECRET` to the front-end.
- `partnerType` is never trusted from the browser body on the typed routes.
- Public endpoints are rate-limited per IP; attachment uploads are capped
  (JSON body limit 30 MB; 5 MB per file client-side).
- `.env` is gitignored — never commit real secrets.
- The in-memory rate limiter resets on restart and is per-instance; for stronger
  protection put a WAF / API gateway in front or move to a shared store.
```
