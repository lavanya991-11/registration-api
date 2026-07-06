// Shared logic for both forms. Each page sets window.SUBMIT_URL (e.g. '/api/customer').
// Plain URL           -> create mode (POST, nested { header, contactLines, bankLines })
// URL with ?regNo=XYZ -> edit mode  (GET to prefill header, then PATCH { header })
(function () {
    const form = document.getElementById('form');
    const msg = document.getElementById('msg');
    const button = form.querySelector('button[type="submit"]');
    const base = window.SUBMIT_URL;

    // Auto-read the registration key from the URL: ?docNo=PR-000001 (or ?regNo=).
    const params = new URLSearchParams(location.search);
    const regNo = params.get('docNo') || params.get('regNo');
    const isEdit = Boolean(regNo);
    const recordUrl = () => `${base}/${encodeURIComponent(regNo)}`;
    const submitUrl = () => `${base}/${encodeURIComponent(regNo)}/submit`;

    // Dynamic link page: it must be opened from a BC link that carries ?docNo=.
    if (window.REQUIRE_DOC && !isEdit) {
        button.disabled = true;
        msg.className = 'err';
        msg.textContent = 'This page must be opened from the registration link sent to you.';
        return;
    }

    // ---- Repeatable line rows (contacts / banks) ----
    function addRow(kind) {
        const tpl = document.getElementById(`${kind}Template`);
        const container = document.getElementById(`${kind}s`);
        const row = tpl.content.firstElementChild.cloneNode(true);
        row.querySelector('.remove').addEventListener('click', () => row.remove());
        container.appendChild(row);
    }
    document.querySelectorAll('[data-add]').forEach((btn) =>
        btn.addEventListener('click', () => addRow(btn.dataset.add))
    );

    // ---- Attachments (optional) ----
    const fileInput = document.getElementById('attachments');
    const fileList = document.getElementById('fileList');
    const attachments = [];
    function renderFiles() {
        if (!fileList) return;
        fileList.innerHTML = '';
        attachments.forEach((a, i) => {
            const li = document.createElement('li');
            const name = document.createElement('span');
            name.textContent = `${a.name}  (${Math.round(a.size / 1024)} KB)`;
            const rm = document.createElement('button');
            rm.type = 'button'; rm.textContent = '×'; rm.title = 'Remove';
            rm.addEventListener('click', () => { attachments.splice(i, 1); renderFiles(); });
            li.appendChild(name); li.appendChild(rm);
            fileList.appendChild(li);
        });
    }
    function readAsBase64(file) {
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result).split(',')[1]);
            r.onerror = reject;
            r.readAsDataURL(file);
        });
    }
    if (fileInput) {
        fileInput.addEventListener('change', async () => {
            for (const f of Array.from(fileInput.files)) {
                if (f.size > 5 * 1024 * 1024) { alert(`${f.name} exceeds 5 MB and was skipped.`); continue; }
                attachments.push({ name: f.name, contentType: f.type, size: f.size, base64: await readAsBase64(f) });
            }
            fileInput.value = '';
            renderFiles();
        });
    }

    function collectLines(kind) {
        const lines = [];
        document.querySelectorAll(`#${kind}s .line-row`).forEach((row) => {
            const obj = {};
            let hasValue = false;
            row.querySelectorAll('[data-field]').forEach((el) => {
                const field = el.dataset.field;
                if (el.type === 'checkbox') {
                    obj[field] = el.checked;
                } else if (el.value.trim() !== '') {
                    obj[field] = el.value.trim();
                    hasValue = true;
                }
            });
            if (hasValue) lines.push(obj);
        });
        return lines;
    }

    function collectHeader() {
        const header = {};
        document.querySelectorAll('#headerSection [name]').forEach((el) => {
            if (el.value.trim() !== '') header[el.name] = el.value.trim();
        });
        return header;
    }

    // ---- Selects populated from a BC-backed endpoint (payment terms / methods) ----
    document.querySelectorAll('select[data-src]').forEach((sel) => {
        const ph = sel.dataset.placeholder || 'Select';
        fetch(sel.dataset.src)
            .then((r) => r.json())
            .then((d) => {
                if (!d.success || !Array.isArray(d.items)) return;
                const current = sel.value;
                sel.innerHTML = `<option value="">${ph}</option>` +
                    d.items.map((i) => `<option value="${i.code}">${i.description || i.code}</option>`).join('');
                if (current) sel.value = current;
            })
            .catch(() => {});
    });

    // ---- Post codes (loaded from BC, filtered by the selected Country/Region) ----
    const postCodeSel = form.elements['postCode'];
    const countrySel = form.elements['countryRegionCode'];
    const citySel = form.elements['city'];
    let allPostCodes = [];
    function fillPostCodes() {
        if (!postCodeSel || postCodeSel.tagName !== 'SELECT') return;
        const country = countrySel ? countrySel.value : '';
        const list = country ? allPostCodes.filter((p) => p.country === country) : [];
        const current = postCodeSel.value;
        const ph = country ? 'Select post code' : 'Select country first';
        postCodeSel.innerHTML = `<option value="">${ph}</option>` +
            list.map((p) => `<option value="${p.code}">${p.code}${p.city ? ' — ' + p.city : ''}</option>`).join('');
        if (current) postCodeSel.value = current;
    }
    if (postCodeSel && postCodeSel.tagName === 'SELECT') {
        fetch('/api/meta/postcodes')
            .then((r) => r.json())
            .then((d) => { if (d.success) { allPostCodes = d.postCodes; fillPostCodes(); } })
            .catch(() => {});
        if (countrySel) countrySel.addEventListener('change', fillPostCodes);
        // Auto-fill City from the chosen post code (if City is empty).
        postCodeSel.addEventListener('change', () => {
            const p = allPostCodes.find((x) => x.code === postCodeSel.value);
            if (p && p.city && citySel && !citySel.value) citySel.value = p.city;
        });
    }

    // ---- Edit mode: load the existing registration and prefill the header ----
    function setInput(name, value) {
        const el = form.elements[name];
        if (!el || value == null) return;
        const v = String(value);
        if (v === '' || v === '0001-01-01') return;
        el.value = v.length > 10 && el.type === 'date' ? v.slice(0, 10) : v;
    }

    if (isEdit) {
        button.textContent = 'Submit Registration';
        msg.textContent = `Loading registration ${regNo}...`;
        fetch(recordUrl())
            .then((r) => r.json())
            .then((data) => {
                if (data.success && data.record) {
                    Object.entries(data.record).forEach(([k, v]) => setInput(k, v));
                    msg.textContent = `Editing registration ${regNo}.`;
                } else {
                    msg.textContent = data.message || 'Could not load the registration.';
                    msg.className = 'err';
                }
            })
            .catch(() => {
                msg.textContent = 'Could not load the registration.';
                msg.className = 'err';
            });
    }

    // ---- Submit ----
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        button.disabled = true;
        msg.textContent = isEdit ? 'Updating...' : 'Submitting...';
        msg.className = '';

        const header = collectHeader();
        const body = { header, contactLines: collectLines('contact'), bankLines: collectLines('bank') };
        if (!isEdit && attachments.length) {
            body.attachments = attachments.map((a) => ({ name: a.name, contentType: a.contentType, base64: a.base64 }));
        }
        // docNo link -> submit via the BC bound action; otherwise create.
        const url = isEdit ? submitUrl() : base;
        const method = 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                msg.className = 'ok';
                if (isEdit) {
                    msg.textContent = data.message || `Registration ${data.regNo || regNo} submitted.`;
                } else {
                    msg.textContent = `${data.message || 'Your registration has been submitted.'} (Ref: ${data.regNo || '—'})`;
                    form.reset();
                    document.querySelectorAll('#contacts .line-row, #banks .line-row').forEach((r) => r.remove());
                    attachments.length = 0; renderFiles();
                }
            } else {
                msg.textContent = data.message || 'Submission failed. Please try again.';
                msg.className = 'err';
            }
        } catch (err) {
            msg.textContent = 'Network error. Please try again.';
            msg.className = 'err';
        } finally {
            button.disabled = false;
        }
    });
})();
