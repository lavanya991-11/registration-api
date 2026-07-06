// Business Central API client — token handling + create/read/update.
const axios = require('axios');
const config = require('../config');

let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
    if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken;

    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.azure.clientId,
        client_secret: config.azure.clientSecret,
        scope: config.azure.scope,
    });

    const { data } = await axios.post(config.azure.tokenUrl, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 20000,
    });

    cachedToken = data.access_token;
    tokenExpiry = Date.now() + data.expires_in * 1000;
    return cachedToken;
}

// Build an entity-set or single-record URL. Code/Text OData keys are quoted.
function entityUrl(entitySet, key) {
    const base = config.bc.apiBase();
    return key ? `${base}/${entitySet}('${encodeURIComponent(key)}')` : `${base}/${entitySet}`;
}

async function authHeaders(extra = {}) {
    const token = await getToken();
    return { Authorization: `Bearer ${token}`, ...extra };
}

async function create(entitySet, payload) {
    const { data } = await axios.post(entityUrl(entitySet), payload, {
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        timeout: 30000,
    });
    return data;
}

// Fetch a single record by its Reg. No. Uses $filter (not keyed access), which
// is deterministic for this code-key API page and always returns one record.
async function getById(entitySet, regNo) {
    const safe = String(regNo).replace(/'/g, "''"); // OData single-quote escape
    const url = `${config.bc.apiBase()}/${entitySet}?$filter=regNo eq '${encodeURIComponent(safe)}'&$top=1`;
    const { data } = await axios.get(url, {
        headers: await authHeaders(),
        timeout: 30000,
    });
    return Array.isArray(data.value) && data.value.length ? data.value[0] : null;
}

async function update(entitySet, regNo, payload) {
    const { data } = await axios.patch(entityUrl(entitySet, regNo), payload, {
        // BC requires If-Match on PATCH; '*' updates regardless of ETag.
        headers: await authHeaders({ 'Content-Type': 'application/json', 'If-Match': '*' }),
        timeout: 30000,
    });
    return data;
}

// Invoke a [ServiceEnabled] bound action, e.g.
//   partnerRegistrations('PR-000001')/Microsoft.NAV.updateRegistration
// args is the JSON body of named parameters (e.g. { payload: '...' }).
// A function returning Text comes back as { value: '...' }.
async function invokeAction(entitySet, key, action, args = {}) {
    const url = `${entityUrl(entitySet, key)}/Microsoft.NAV.${action}`;
    const { data } = await axios.post(url, args, {
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        timeout: 30000,
    });
    return data;
}

// List post codes from BC (for the Post Code dropdown).
async function listPostCodes() {
    const token = await getToken();
    const url = `${config.bc.apiBase()}/postCodes?$top=5000&$select=code,city,countryRegionCode`;
    const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, timeout: 30000 });
    return (data.value || []).map((p) => ({ code: p.code, city: p.city, country: p.countryRegionCode }));
}

// Attach files to a registration via partnerRegAttachments.attachmentsJson
// (a JSON array of { fileName, base64 }). BC processes it into Document Attachments.
async function attachToRegistration(regNo, files) {
    if (!Array.isArray(files) || files.length === 0) return;
    const attachmentsJson = JSON.stringify(
        files.map((f) => ({ fileName: f.fileName || f.name, base64: f.base64 }))
    );
    const { data } = await axios.patch(
        entityUrl('partnerRegAttachments', regNo),
        { attachmentsJson },
        { headers: await authHeaders({ 'Content-Type': 'application/json', 'If-Match': '*' }), timeout: 60000 }
    );
    return data;
}

// List payment methods / payment terms from BC (code + description).
async function listByCode(entitySet) {
    const token = await getToken();
    const url = `${config.bc.apiBase()}/${entitySet}?$select=code,description&$top=500`;
    const { data } = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, timeout: 30000 });
    return (data.value || []).map((p) => ({ code: p.code, description: p.description }));
}
const listPaymentMethods = () => listByCode('paymentMethods');
const listPaymentTerms = () => listByCode('paymentTerms');

module.exports = { getToken, create, getById, update, invokeAction, attachToRegistration, listPostCodes, listPaymentMethods, listPaymentTerms, entityUrl };
