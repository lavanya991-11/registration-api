const express = require('express');
const cors = require('cors');
const path = require('path');

const config = require('./config');
const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// ---- Global middleware ----
app.use(cors());
app.use(express.json({ limit: '30mb' })); // allow base64 attachment uploads

// ---- Static registration forms (customer.html / vendor.html) ----
// no-cache: browsers revalidate each load, so UI updates appear without a hard refresh.
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
}));

// ---- Health check ----
app.get('/health', (_req, res) => res.json({ ok: true }));

// ---- API ----
app.use('/api', apiRoutes);

// ---- 404 + error handling (must be last) ----
app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
    console.log(`Registration API running on http://localhost:${config.port}`);
    console.log(`  Customer:  POST /api/customer   |  GET & PATCH /api/customer/:regNo`);
    console.log(`  Vendor:    POST /api/vendor     |  GET & PATCH /api/vendor/:regNo`);
    console.log(`  Forms:     /customer.html  |  /vendor.html`);
});

module.exports = app;
