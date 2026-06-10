/* ============================================================
   Z-Wave UI Rework — Mockup interactivity (vanilla JS)
   ============================================================ */
(function () {
  const root = document.documentElement;

  // ---- Theme (persisted) ----
  const savedTheme = localStorage.getItem('zw-theme');
  if (savedTheme) root.setAttribute('data-theme', savedTheme);
  window.toggleTheme = function () {
    const cur = root.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    localStorage.setItem('zw-theme', next);
    syncThemeIcon();
  };
  function syncThemeIcon() {
    const isDark = root.getAttribute('data-theme') === 'dark'
      || (!root.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelectorAll('[data-theme-icon]').forEach(el => el.textContent = isDark ? '☀' : '☾');
  }

  // ---- Advanced mode (persisted) ----
  const savedAdv = localStorage.getItem('zw-advanced') || 'off';
  root.setAttribute('data-advanced', savedAdv);
  window.toggleAdvanced = function (el) {
    const next = root.getAttribute('data-advanced') === 'on' ? 'off' : 'on';
    root.setAttribute('data-advanced', next);
    localStorage.setItem('zw-advanced', next);
    syncAdv();
  };
  function syncAdv() {
    const on = root.getAttribute('data-advanced') === 'on';
    document.querySelectorAll('[data-adv-switch]').forEach(i => i.checked = on);
  }

  // ---- Tabs ----
  window.showTab = function (btn, id) {
    const tabs = btn.closest('.tabs');
    tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const scope = tabs.parentElement;
    scope.querySelectorAll('.tabpanel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(id);
    if (panel) panel.classList.add('active');
  };

  // ---- Inline reveal (Show advanced / details) ----
  window.toggleReveal = function (btn, id) {
    const body = document.getElementById(id);
    if (!body) return;
    const open = body.classList.toggle('open');
    const cue = btn.querySelector('[data-caret]');
    if (cue) cue.textContent = open ? '⌃' : '⌄';
    const lbl = btn.querySelector('[data-reveal-label]');
    if (lbl && lbl.dataset.alt) { const t = lbl.textContent; lbl.textContent = lbl.dataset.alt; lbl.dataset.alt = t; }
  };

  // ---- Favorite toggle ----
  window.toggleFav = function (e, el) { e.stopPropagation(); el.classList.toggle('active'); el.textContent = el.classList.contains('active') ? '★' : '☆'; };

  // ---- Card toggle (stop propagation so card click ≠ control click) ----
  window.stop = function (e) { e.stopPropagation(); };

  // ---- Mobile drawer (sidebar) ----
  window.toggleMenu = function () {
    let d = document.getElementById('mobile-drawer');
    if (d) d.classList.toggle('open');
  };

  // ---- Demo navigation hint ----
  window.go = function (href) { if (href) location.href = href; };

  document.addEventListener('DOMContentLoaded', function () { syncThemeIcon(); syncAdv(); });
})();
