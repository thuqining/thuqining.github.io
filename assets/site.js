// ---- theme toggle (shared across pages) ----
(function () {
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('themeBtn');
  if (btn) btn.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', cur);
    localStorage.setItem('theme', cur);
  });
})();

// ---- publication filter (pages that have one) ----
(function () {
  const wrap = document.getElementById('pubFilters');
  if (!wrap) return;
  wrap.addEventListener('click', e => {
    const b = e.target.closest('.filter'); if (!b) return;
    wrap.querySelectorAll('.filter').forEach(f => f.classList.remove('active'));
    b.classList.add('active');
    const t = b.dataset.type;
    document.querySelectorAll('.publist .pub').forEach(li => {
      li.classList.toggle('hidden', t !== 'all' && li.dataset.type !== t);
    });
    document.querySelectorAll('[data-group]').forEach(g => {
      g.classList.toggle('hidden', t !== 'all' && g.dataset.group !== t);
    });
  });
})();
