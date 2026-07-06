// Turns the form into a multi-step wizard:
//   Step 1: company details (#headerSection)
//   Step 2: Contacts   Step 3: Bank Accounts   Step 4: Attachments
// All fields stay in the DOM (hidden steps still submit), so form.js is untouched.
(function () {
    const form = document.getElementById('form');
    if (!form) return;
    const body = form.querySelector('.body');
    const footer = form.querySelector('.footer');
    if (!body || !footer) return;

    const secOf = (id) => (document.getElementById(id) ? document.getElementById(id).closest('section.block') : null);
    const steps = [
        document.getElementById('headerSection'),
        secOf('contacts'),
        secOf('banks'),
        secOf('attachments'),
    ].filter(Boolean);
    if (steps.length < 2) return; // e.g. register.html — no wizard

    const titles = ['Company Details', 'Contacts', 'Bank Accounts', 'Attachments'];
    const last = steps.length - 1;
    let current = 0;

    // ---- stepper ----
    const stepper = document.createElement('div');
    stepper.className = 'stepper';
    steps.forEach((_, i) => {
        const item = document.createElement('div');
        item.className = 'step-item';
        item.innerHTML = `<span class="dot">${i + 1}</span><span class="lbl">${titles[i] || 'Step ' + (i + 1)}</span>`;
        item.addEventListener('click', () => { if (i < current) { current = i; render(); } });
        stepper.appendChild(item);
    });
    form.insertBefore(stepper, body);

    // ---- footer buttons ----
    const cancelBtn = footer.querySelector('.btn.cancel');
    const submitBtn = footer.querySelector('.btn.submit');
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button'; prevBtn.className = 'btn cancel back';
    prevBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg> Previous';
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button'; nextBtn.className = 'btn submit next';
    nextBtn.innerHTML = 'Next <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

    const left = document.createElement('div'); left.className = 'footer-left';
    const right = document.createElement('div'); right.className = 'footer-right';
    if (cancelBtn) left.appendChild(cancelBtn);
    left.appendChild(prevBtn);
    right.appendChild(nextBtn);
    if (submitBtn) right.appendChild(submitBtn);
    footer.appendChild(left); footer.appendChild(right);

    function validateStep(i) {
        const fields = steps[i].querySelectorAll('input[required], select[required], textarea[required]');
        for (const f of fields) {
            if (!f.checkValidity()) { f.reportValidity(); return false; }
        }
        return true;
    }

    function render() {
        steps.forEach((el, i) => { el.hidden = i !== current; });
        [...stepper.children].forEach((item, i) => {
            item.classList.toggle('active', i === current);
            item.classList.toggle('done', i < current);
            item.querySelector('.dot').textContent = i < current ? '✓' : (i + 1);
        });
        if (cancelBtn) cancelBtn.hidden = current !== 0;
        prevBtn.hidden = current === 0;
        nextBtn.hidden = current === last;
        if (submitBtn) submitBtn.hidden = current !== last;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    nextBtn.addEventListener('click', () => { if (validateStep(current)) { current = Math.min(current + 1, last); render(); } });
    prevBtn.addEventListener('click', () => { current = Math.max(current - 1, 0); render(); });

    // Don't submit on Enter unless on the last step.
    form.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && current !== last) e.preventDefault();
    });

    render();
})();
