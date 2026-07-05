// Tiny in-memory rate limiter for the public endpoints (no external deps).
const config = require('../config');

const hits = new Map(); // ip -> { count, resetAt }

module.exports = function rateLimit(req, res, next) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = hits.get(ip);

    if (!entry || now > entry.resetAt) {
        hits.set(ip, { count: 1, resetAt: now + config.rateLimit.windowMs });
        return next();
    }
    if (entry.count >= config.rateLimit.max) {
        return res.status(429).json({
            success: false,
            errorCode: 'RATE_LIMITED',
            message: 'Too many submissions. Please try again later.',
        });
    }
    entry.count += 1;
    next();
};
