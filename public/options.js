// Populates every <select data-options="..."> on the page.
// NOTE: extend/adjust these lists to match your Business Central configuration
// (Country/Region, Currency, PP Entity Type, Partner Category).
(function () {
    const COUNTRIES = [
        ['AE', 'United Arab Emirates'], ['SA', 'Saudi Arabia'], ['OM', 'Oman'], ['BH', 'Bahrain'],
        ['KW', 'Kuwait'], ['QA', 'Qatar'], ['IN', 'India'], ['PK', 'Pakistan'], ['EG', 'Egypt'],
        ['JO', 'Jordan'], ['LB', 'Lebanon'], ['GB', 'United Kingdom'], ['US', 'United States'],
        ['CA', 'Canada'], ['DE', 'Germany'], ['FR', 'France'], ['IT', 'Italy'], ['ES', 'Spain'],
        ['NL', 'Netherlands'], ['CN', 'China'], ['JP', 'Japan'], ['SG', 'Singapore'],
        ['AU', 'Australia'], ['ZA', 'South Africa'], ['TR', 'Turkey'], ['PH', 'Philippines'],
        ['BD', 'Bangladesh'], ['LK', 'Sri Lanka'], ['NG', 'Nigeria'], ['KE', 'Kenya'],
    ];
    const CURRENCIES = ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'OMR', 'BHD', 'KWD', 'QAR', 'INR', 'PKR', 'EGP', 'JPY', 'CNY', 'CAD', 'AUD', 'CHF', 'SGD', 'ZAR', 'TRY'];
    const ENTITIES = ['LLC', 'FZE', 'FZC', 'Free Zone Company', 'Sole Establishment', 'Civil Company', 'Partnership', 'Branch', 'Public Joint Stock Company', 'Private Joint Stock Company', 'Establishment', 'Other'];
    const CATEGORIES = ['Distributor', 'Retailer', 'Wholesaler', 'Manufacturer', 'Supplier', 'Service Provider', 'Domestic', 'International'];

    function optionsFor(kind) {
        if (kind === 'country') return COUNTRIES.map(([c, n]) => `<option value="${c}">${n} (${c})</option>`).join('');
        if (kind === 'currency') return CURRENCIES.map(c => `<option value="${c}">${c}</option>`).join('');
        if (kind === 'entity') return ENTITIES.map(e => `<option value="${e}">${e}</option>`).join('');
        if (kind === 'category') return CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
        return '';
    }

    document.querySelectorAll('select[data-options]').forEach(sel => {
        const ph = sel.dataset.placeholder || 'Select';
        sel.innerHTML = `<option value="">${ph}</option>` + optionsFor(sel.dataset.options);
    });
})();
