// Fills owner name and contact email on the legal pages from js/config.js.
(function () {
  const c = window.NPT_CONFIG || {};
  const email = (c.contactEmail || '').trim(), owner = (c.ownerName || '').trim();
  document.querySelectorAll('[data-fill="contact"]').forEach(el => {
    if (!email) return;
    el.textContent = 'Email: ';
    const a = document.createElement('a'); a.href = 'mailto:' + email; a.textContent = email; el.appendChild(a);
  });
  document.querySelectorAll('[data-fill="owner"]').forEach(el => { if (owner) el.textContent = owner; });
})();
