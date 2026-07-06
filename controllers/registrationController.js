// Request handlers for partner registrations. The same logic serves both
// Customer and Vendor — the routes bind it to a partnerType, and every call
// goes to the existing partnerRegistrations API (page 90123). No new BC objects.
const config = require('../config');
const bc = require('../modules/bcClient');
const {
    newRegNo,
    getHeader,
    toBcPayload,
    toBcUpdatePayload,
    validContactLines,
    validBankLines,
    validate,
    validateUpdate,
} = require('../modules/registrationMapper');

const ENTITY = 'partnerRegistrations';
const CONTACT_ENTITY = 'partnerRegContactLines';
const BANK_ENTITY = 'partnerRegBankLines';

const SUCCESS_MESSAGE = 'Registration received. You will hear from us shortly.';

// Maps a failure to the { success, errorCode, message } contract.
function fail(res, httpStatus, errorCode, message) {
    return res.status(httpStatus).json({ success: false, errorCode, message });
}

// partnerType: 'Customer' | 'Vendor' fixed by the route, or null to read it
// from the request body (the unified /api/registration endpoint).
module.exports = function createController(partnerType) {
    function handleBcError(err, res, action, regNo) {
        const status = err.response?.status;
        const bcMsg = err.response?.data?.error?.message || err.message;
        console.error(`[${action} ${partnerType}${regNo ? '/' + regNo : ''}] ${status || ''} ${bcMsg}`);

        if (status === 404) return fail(res, 404, 'NOT_FOUND', `Registration ${regNo || ''} was not found.`.trim());
        if (/already.*(registered|used|exist)|e-?mail.*(used|exist)/i.test(bcMsg))
            return fail(res, 400, 'EMAIL_ALREADY_USED', bcMsg);
        if (status && status >= 400 && status < 500) return fail(res, 400, 'BC_VALIDATION', bcMsg);
        return fail(res, 502, 'BC_ERROR', bcMsg);
    }

    return {
        // POST /  — create header, then child lines; return the envelope.
        async create(req, res) {
            // partnerType from the route, or from the body on the unified endpoint.
            const type = partnerType || req.body?.partnerType;
            if (type !== 'Customer' && type !== 'Vendor')
                return fail(res, 400, 'VALIDATION_ERROR', "partnerType must be 'Customer' or 'Vendor'.");

            const error = validate(req.body);
            if (error) return fail(res, 400, 'VALIDATION_ERROR', error);

            if (req.body?.sourceIp) console.log(`[create ${type}] sourceIp=${req.body.sourceIp}`);

            let regNo;
            try {
                // If BC's No. Series isn't configured, generate a regNo so the
                // insert doesn't require it (toggle via GENERATE_REG_NO).
                // 1) Create the header record. (regNo generated if BC No. Series isn't set.)
                const preRegNo = config.regNo.generate ? newRegNo(config.regNo.prefix) : undefined;
                const created = await bc.create(ENTITY, toBcPayload(req.body, type, preRegNo));
                regNo = created.regNo;

                // 2) Send contacts + banks + attachments as ONE payload to the
                //    updateRegistration action; PP Partner Reg. Updater processes them all.
                const contactLines = validContactLines(req.body);
                const bankLines = validBankLines(req.body);
                const attachments = (Array.isArray(req.body?.attachments) ? req.body.attachments : [])
                    .map((a) => ({ fileName: a.fileName || a.name, base64: a.base64 }))
                    .filter((a) => a.fileName && a.base64);
                if (contactLines.length || bankLines.length || attachments.length) {
                    const registration = { partnerType: type, header: getHeader(req.body), contactLines, bankLines, attachments };
                    await bc.invokeAction(ENTITY, regNo, 'updateRegistration', { payload: JSON.stringify(registration) });
                    console.log(`[create ${type}/${regNo}] payload: ${contactLines.length} contact(s), ${bankLines.length} bank(s), ${attachments.length} attachment(s)`);
                }

                return res.status(201).json({
                    success: true,
                    regNo,
                    status: created.status,
                    message: SUCCESS_MESSAGE,
                });
            } catch (err) {
                return handleBcError(err, res, 'create', regNo);
            }
        },

        // GET /:regNo  — read one (edit-page prefill)
        async getOne(req, res) {
            const key = req.params.regNo || req.params.docNo;
            try {
                const record = await bc.getById(ENTITY, key);
                if (!record) return fail(res, 404, 'NOT_FOUND', `Registration ${key} was not found.`);
                return res.json({ success: true, record });
            } catch (err) {
                return handleBcError(err, res, 'load', key);
            }
        },

        // POST /:docNo/submit  — invoke the BC bound action updateRegistration.
        // Body is either { payload: "<json string>" } or the nested registration
        // object (which is JSON-stringified into the payload argument).
        async submit(req, res) {
            const docNo = req.params.docNo;
            const payload = typeof req.body?.payload === 'string'
                ? req.body.payload
                : JSON.stringify(req.body ?? {});
            try {
                const result = await bc.invokeAction(ENTITY, docNo, 'updateRegistration', { payload });
                return res.json({
                    success: true,
                    regNo: docNo,
                    result: result?.value ?? result,
                    message: 'Registration submitted.',
                });
            } catch (err) {
                return handleBcError(err, res, 'submit', docNo);
            }
        },

        // PATCH /:regNo  — partial header update
        async update(req, res) {
            const error = validateUpdate(req.body);
            if (error) return fail(res, 400, 'VALIDATION_ERROR', error);
            try {
                const updated = await bc.update(ENTITY, req.params.regNo, toBcUpdatePayload(req.body));
                return res.json({
                    success: true,
                    regNo: updated.regNo,
                    status: updated.status,
                    message: 'Registration updated.',
                });
            } catch (err) {
                return handleBcError(err, res, 'update', req.params.regNo);
            }
        },
    };
};
