// Maps the public request contract to BC API field names.
//
// Request contract (nested):
//   { partnerType, sourceIp, header: {...}, contactLines: [...], bankLines: [...] }
// A flat body (fields at top level) is also accepted for backward compatibility.
//
// partnerType is set by the backend per form (Customer vs Vendor) — never trusted
// from the browser body.

// --- Header fields exposed by partnerRegistrations (page 90123) ---
const HEADER_FIELDS = [
    'tradeName',
    'partnerEmail',
    'tradeLicenseNumber',
    'tradeLicenseExpiryDate',
    'companyRegNumber',
    'entityType',
    'countryOfIncorporation',
    'placeOfRegistration',
    'website',
    'phoneNo',
    'address',
    'address2',
    'city',
    'postCode',
    'countryRegionCode',
    'vatRegistrationNo',
    'currencyCode',
    'paymentMethodCode',
    'paymentTermsCode',
    'partnerCategory',
];

// --- Child line fields. NOTE: these names come from the request example.
//     Confirm against the BC "Partner Reg. Contact Lines API" /
//     "Partner Reg. Bank Lines API" field names and adjust if different. ---
const CONTACT_FIELDS = ['fullName', 'designation', 'mobileNumber', 'emailAddress'];
const BANK_FIELDS = ['bankCode', 'name', 'bankBranchNo', 'bankAccountNo', 'iban', 'swiftCode', 'currencyCode', 'isPrimary'];

// Returns the header object whether the body is nested ({header:{...}}) or flat.
function getHeader(body) {
    if (body && typeof body.header === 'object' && body.header) return body.header;
    return body || {};
}

// The regPortal intake codeunit (custRegIntake / vendRegIntake) expects the partner
// email under a TYPE-SPECIFIC field: customerEmail for Customer, vendorEmail for
// Vendor. The public form still submits `partnerEmail`, so copy it across here.
// Other header fields are unchanged.
function toIntakeHeader(header, partnerType) {
    const emailField = partnerType === 'Vendor' ? 'vendorEmail' : 'customerEmail';
    const out = { ...(header || {}) };
    if (out.partnerEmail && !out[emailField]) out[emailField] = out.partnerEmail;
    return out;
}

function pick(source, fields) {
    const out = {};
    for (const key of fields) {
        const value = source[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            out[key] = value;
        }
    }
    return out;
}

// Generates a unique, short registration number (fits Code[20]).
// e.g. WEB-LV8Q 3K2-A7  ->  "WEB-" + base36(time) + "-" + 2 random chars
function newRegNo(prefix = 'WEB') {
    const t = Date.now().toString(36).toUpperCase();
    const r = Math.random().toString(36).slice(2, 4).toUpperCase();
    return `${prefix}-${t}-${r}`.slice(0, 20);
}

// CREATE header payload — forces regType, stamps partnerType server-side.
// If regNo is provided, it's included (bypasses BC's No. Series requirement).
function toBcPayload(body, partnerType, regNo) {
    const payload = { regType: 'Create', ...pick(getHeader(body), HEADER_FIELDS) };
    if (partnerType) payload.partnerType = partnerType;
    if (regNo) payload.regNo = regNo;
    return payload;
}

// UPDATE header payload — partial; only supplied fields, never regType/partnerType.
function toBcUpdatePayload(body) {
    return pick(getHeader(body), HEADER_FIELDS);
}

// Child line payloads. regNo links the line to its parent registration.
function toBcContactLine(line, regNo) {
    return { regNo, ...pick(line, CONTACT_FIELDS) };
}
function toBcBankLine(line, regNo) {
    return { regNo, ...pick(line, BANK_FIELDS) };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function validate(body) {
    const header = getHeader(body);
    if (!header || typeof header !== 'object') return 'Invalid request body.';
    if (!header.tradeName || String(header.tradeName).trim().length < 2)
        return 'Trade name is required.';
    if (!header.partnerEmail || !EMAIL_RE.test(header.partnerEmail))
        return 'A valid partner email is required.';
    if (!header.countryRegionCode || String(header.countryRegionCode).trim() === '')
        return 'Country/region code is required.';
    // Any contact line that has an email must have a valid one.
    const badContact = (Array.isArray(body?.contactLines) ? body.contactLines : [])
        .find((l) => l && l.emailAddress && !EMAIL_RE.test(l.emailAddress));
    if (badContact) return `Invalid contact email: ${badContact.emailAddress}`;
    return null;
}

// Only contact lines with a fullName are kept (per the contract).
function validContactLines(body) {
    return (Array.isArray(body?.contactLines) ? body.contactLines : [])
        .filter((l) => l && String(l.fullName || '').trim() !== '');
}

function validBankLines(body) {
    return Array.isArray(body?.bankLines) ? body.bankLines : [];
}

function validateUpdate(body) {
    const header = getHeader(body);
    if (!header || typeof header !== 'object') return 'Invalid request body.';
    if (Object.keys(pick(header, HEADER_FIELDS)).length === 0) return 'No updatable fields supplied.';
    if (header.partnerEmail !== undefined &&
        !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(header.partnerEmail))
        return 'A valid email is required.';
    return null;
}

module.exports = {
    HEADER_FIELDS,
    getHeader,
    toIntakeHeader,
    newRegNo,
    toBcPayload,
    toBcUpdatePayload,
    toBcContactLine,
    toBcBankLine,
    validContactLines,
    validBankLines,
    validate,
    validateUpdate,
};
