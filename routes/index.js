// Mounts all API routers under /api.
const express = require('express');

const router = express.Router();

router.use('/registration', require('./registrationRoutes'));
router.use('/customer', require('./customerRoutes'));
router.use('/vendor', require('./vendorRoutes'));

module.exports = router;
