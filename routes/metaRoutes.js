// Reference-data endpoints for the form dropdowns (post codes from BC).
const express = require('express');
const bc = require('../modules/bcClient');
const rateLimit = require('../middleware/rateLimit');

const router = express.Router();

let cache = null;
let cachedAt = 0;
const TTL = 60 * 60 * 1000; // 1 hour

router.get('/postcodes', rateLimit, async (req, res) => {
    try {
        if (!cache || Date.now() - cachedAt > TTL) {
            cache = await bc.listPostCodes();
            cachedAt = Date.now();
        }
        let list = cache;
        if (req.query.country) list = list.filter((p) => p.country === req.query.country);
        res.json({ success: true, postCodes: list });
    } catch (err) {
        console.error('[postcodes]', err.response?.status, err.message);
        res.status(502).json({ success: false, errorCode: 'BC_ERROR', message: 'Could not load post codes.' });
    }
});

module.exports = router;
