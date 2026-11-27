// Backup and restore: saves everything the app keeps in this browser (paper account, watchlist,
// chart drawings and indicators, settings, challenge scores) to a small JSON file, and loads it back.
// Imported CSV price data is not included (it can be large); re-import those files instead.
(function () {
  const P = window.PP; if (!P) return;
  const { $, toast, store } = P;
  const PREFIX = 'npt_', SKIP = new Set(['npt_bk_last']);

  function keys() {
    const out = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX) && !SKIP.has(k)) out.push(k); } } catch { }
    return out.sort();
  }
  const today = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);   // India date
  const nice = iso => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  function showLast() { const t = store.get('npt_bk_last', null); $('bkLast').textContent = t ? `Last backup: ${nice(t)}` : 'No backup made yet.'; }

  function summary(data) {
    const get = k => { try { return JSON.parse(data[k]); } catch { return null; } };
    const acct = get('npt_paper_v1'), w = get('npt_watch'), lines = get('npt_cv_lines');
    const parts = [];
    if (acct) parts.push(`paper account with ${Object.keys(acct.pos || {}).length} holding(s) and ${(acct.orders || []).length} order(s)`);
    if (Array.isArray(w)) parts.push(`${w.length} watchlist stock(s)`);
    if (lines && typeof lines === 'object') { const n = Object.values(lines).reduce((a, x) => a + (Array.isArray(x) ? x.length : 0), 0); if (n) parts.push(`${n} chart line(s)`); }
    parts.push('settings');
    return parts.join(', ');
  }

  function save() {
    const data = {}; keys().forEach(k => { data[k] = localStorage.getItem(k); });
    const file = { app: 'PaperPaisaa', kind: 'backup', version: 1, saved: new Date().toISOString(), data };
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `paperpaisaa-backup-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    store.set('npt_bk_last', file.saved); showLast();
    toast('Backup saved: ' + summary(data));
  }

  async function load(f) {
    let file;
    try { file = JSON.parse(await f.text()); } catch { return toast('That file is not a PaperPaisaa backup.'); }
    if (!file || file.app !== 'PaperPaisaa' || file.kind !== 'backup' || !file.data || typeof file.data !== 'object') return toast('That file is not a PaperPaisaa backup.');
    const data = Object.fromEntries(Object.entries(file.data).filter(([k, v]) => k.startsWith(PREFIX) && !SKIP.has(k) && typeof v === 'string' && v.length < 5e6));
    if (!Object.keys(data).length) return toast('This backup is empty.');
    if (!confirm(`Restore the backup from ${nice(file.saved)}?\n\nIt contains: ${summary(data)}.\n\nThis replaces what is saved in this browser now.`)) return;
    try {
      keys().forEach(k => localStorage.removeItem(k));
      Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
    } catch { return toast('Could not restore: this browser is blocking saved data (private mode?).'); }
    sessionStorage.setItem('npt_restored', '1');
    location.reload();
  }

  document.addEventListener('click', e => {
    if (e.target.closest('.bk-save')) { e.preventDefault(); save(); }
    else if (e.target.closest('.bk-load')) { e.preventDefault(); $('bkFile').value = ''; $('bkFile').click(); }
  });
  $('bkFile').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) load(f); });
  showLast();
  try { if (sessionStorage.getItem('npt_restored')) { sessionStorage.removeItem('npt_restored'); setTimeout(() => toast('Backup restored.'), 600); } } catch { }
})();
