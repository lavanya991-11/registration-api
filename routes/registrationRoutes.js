// Unified endpoint that matches the contract's top-level "partnerType" field.
// POST /api/registration  with { partnerType: "Customer|Vendor", header, ... }
const express = require('express');
const createController = require('../controllers/registrationController');
const rateLimit = require('../middleware/rateLimit');

const router = express.Router();
const controller = createController(null); // partnerType read from the body

router.post('/', rateLimit, controller.create);
// Doc-number driven (the BC link flow): read to prefill, submit to save.
router.get('/:docNo', rateLimit, controller.getOne);
router.post('/:docNo/submit', rateLimit, controller.submit);

module.exports = router;
