const express = require('express');
const createController = require('../controllers/registrationController');
const rateLimit = require('../middleware/rateLimit');

const router = express.Router();
const controller = createController('Customer');

router.post('/', rateLimit, controller.create);
router.post('/:docNo/submit', rateLimit, controller.submit);
router.get('/:regNo', rateLimit, controller.getOne);
router.patch('/:regNo', rateLimit, controller.update);

module.exports = router;
