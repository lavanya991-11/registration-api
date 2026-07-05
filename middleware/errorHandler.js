// Catches anything a controller forwards via next(err), plus unknown routes.
// All responses follow the { success, errorCode, message } contract.

function notFound(req, res) {
    res.status(404).json({
        success: false,
        errorCode: 'NOT_FOUND',
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    console.error('[unhandled]', err.message);
    if (res.headersSent) return next(err);
    res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_ERROR',
        message: 'Registration could not be processed. Please try again.',
    });
}

module.exports = { notFound, errorHandler };
