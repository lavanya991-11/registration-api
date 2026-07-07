// Central configuration — every environment value is read here (and nowhere else).
require('dotenv').config();

const config = {
    port: process.env.PORT || 3000,

    // Azure AD (service-to-service / client credentials)
    azure: {
        tenantId: process.env.TENANT_ID,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        tokenUrl:
            process.env.BC_TOKEN_URL ||
            `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
        scope: process.env.BC_SCOPE || 'https://api.businesscentral.dynamics.com/.default',
    },

    // Business Central API location
    bc: {
        host: process.env.BC_API_HOST || 'api.businesscentral.dynamics.com',
        environment: process.env.BC_ENVIRONMENT,
        companyId: process.env.BC_COMPANY_ID,
        publisher: process.env.BC_API_PUBLISHER || 'regPortal',
        group: process.env.BC_API_GROUP || 'regPortal',
        version: process.env.BC_API_VERSION || 'v2.0',
    },

    // Public endpoint protection
    rateLimit: {
        windowMs: 60 * 1000,
        max: 10,
    },

    // Registration numbering.
    //  generate=false (default): leave regNo blank -> BC assigns it from the
    //    "Partner Reg. Nos." No. Series in Partner Portal Setup (the proper way).
    //  generate=true: the backend generates a unique regNo and sends it, so
    //    creation works even when the BC No. Series is not configured.
    regNo: {
        generate: process.env.GENERATE_REG_NO === 'true',
        prefix: process.env.REG_NO_PREFIX || 'WEB',
    },
};

// .../api/regPortal/regPortal/v2.0/companies(<guid>)
// Empty publisher/group segments are skipped, so the route shape is fully
// configurable (e.g. the legacy "partnerPortal/partnerPortal" still works).
config.bc.apiBase = () => {
    const route = [config.bc.publisher, config.bc.group, config.bc.version].filter(Boolean).join('/');
    return `https://${config.bc.host}/v2.0/${config.bc.environment}/api/${route}` +
        `/companies(${config.bc.companyId})`;
};

module.exports = config;
