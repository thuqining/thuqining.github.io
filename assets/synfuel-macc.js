/* Abatement cost curves from Fig. 5 of the synthetic-fuel paper (data in synfuel-macc-data.js), animated.
   Each block is a country-fuel pair: width = CO2 displaced, height = cost premium per tonne. The curve starts
   sorted by the cost premium on fuel cost alone; the security value then pulls the imported-supply blocks down
   to their net premium and the curve re-sorts, so the CO2 abatement that pays off (height <= 0) grows, e.g.
   from 0.27 to 0.85 GtCO2/yr at 2030 costs. Cycles through cost years 2030, 2040 and 2050.
   Respects prefers-reduced-motion (shows 2030 with security value) and pauses when off screen. */
(function () {
  const cv = document.getElementById("sig5macc"), D = window.SYNFUEL_MACC;
  if (!cv || !D) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const YEARS = ["2030", "2040", "2050"], XM = 2.0, YLO = -320, YHI = 320;
  // per year: x position of each block when sorted by cost premium and when sorted by net premium
  const Y = {};
  YEARS.forEach((yr) => {
    const b = D.years[yr].blocks.map(([w, c, n]) => ({ w, c, n }));
    const place = (key, out) => { let x0 = 0; [...b].sort((p, q) => p[key] - q[key]).forEach((p) => { p[out] = x0; x0 += p.w; }); };
    place("c", "xc"); place("n", "xn");
    Y[yr] = { b, cost: D.years[yr].cost_only, sec: D.years[yr].with_security };
  });
  function pal() {
    const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
    return { accent: v("--accent"), accent2: v("--accent-2"), ink: v("--ink"), ink2: v("--ink-2"), ink3: v("--ink-3"), card: v("--card"), soft: v("--bg-soft") };
  }
  function rgba(col, a) {
    if (!col.startsWith("#")) return col;
    const h = col.length === 4 ? col.replace(/#(.)(.)(.)/, "#$1$1$2$2$3$3") : col;
    const n = parseInt(h.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function fit() {
    const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(r.width * d) || cv.height !== Math.round(r.height * d)) {
      cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
    }
    const x = cv.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0);
    return [x, r.width, r.height];
  }
  const ease = (s) => { const k = Math.max(0, Math.min(1, s)); return k * k * (3 - 2 * k); };
  const label = (x, txt, px, py, col, size, wt) => { x.font = `${wt || 500} ${size || 11}px Inter, sans-serif`; x.fillStyle = col; x.fillText(txt, px, py); };
  const tag = (x, txt, px, py, col, size) => { x.font = `italic ${size || 13}px Fraunces, Georgia, serif`; x.fillStyle = col; x.fillText(txt, px, py); };
  const gt = (v) => (v - 0.0005).toFixed(2);   // two decimals as in the paper (0.275 → 0.27)
  const C = 560;
  let t = 0;
  function draw() {
    const [x, w, h] = fit(), P = pal();
    x.clearRect(0, 0, w, h);
    t += 1;
    const yi = reduce ? 0 : Math.floor(t / C) % 3, c = reduce ? C - 1 : t % C, yr = YEARS[yi], Q = Y[yr];
    const s = ease((c - 130) / 190);                       // 0: fuel cost alone, 1: with security value
    const L = 54, R = w - 14, T = 64, B = h - 40;
    const X = (g) => L + (R - L) * g / XM, Yp = (v) => T + (B - T) * (YHI - Math.max(YLO, Math.min(YHI, v))) / (YHI - YLO);
    // grid and axes
    x.font = "500 10.5px Inter, sans-serif";
    [-300, -150, 0, 150, 300].forEach((v) => {
      x.strokeStyle = rgba(P.ink3, v === 0 ? 0.7 : 0.15); x.lineWidth = 1;
      x.beginPath(); x.moveTo(L, Yp(v) + 0.5); x.lineTo(R, Yp(v) + 0.5); x.stroke();
      x.fillStyle = P.ink3; const tx = String(v), tw = x.measureText(tx).width; x.fillText(tx, L - 6 - tw, Yp(v) + 4);
    });
    [0, 0.5, 1, 1.5, 2].forEach((g) => { x.fillStyle = P.ink3; x.fillText(String(g), X(g) - 6, B + 15); });
    x.font = "600 11px Inter, sans-serif"; x.fillStyle = P.ink2;
    { const yl = "cost premium (US$/tCO₂)", tw = x.measureText(yl).width; x.save(); x.translate(12, (T + B) / 2 + tw / 2); x.rotate(-Math.PI / 2); x.fillText(yl, 0, 0); x.restore(); }
    { const xl = "CO₂ displaced (GtCO₂/yr)", tw = x.measureText(xl).width; x.fillText(xl, (L + R - tw) / 2, B + 30); }
    // blocks
    let paid = 0;
    x.save(); x.beginPath(); x.rect(L, T - 4, R - L, B - T + 8); x.clip();
    Q.b.forEach((p) => {
      const xs = p.xc + (p.xn - p.xc) * s;
      if (xs > XM) return;
      const hv = p.c + (p.n - p.c) * s, y0 = Yp(0), y1 = Yp(hv);
      const col = p.c <= 0 ? rgba(P.accent, 0.92) : hv <= 0 ? rgba(P.accent2, 0.8) : rgba(P.ink3, 0.32);
      if (hv <= 0) paid += p.w;
      x.fillStyle = col; x.fillRect(X(xs), Math.min(y0, y1), Math.max(0.6, X(xs + p.w) - X(xs)), Math.max(1, Math.abs(y1 - y0)));
    });
    x.restore();
    // abatement that pays off: fuel cost alone (dotted) and with security value (dashed)
    const vline = (g, dash, col) => { x.setLineDash(dash); x.strokeStyle = col; x.lineWidth = 1.6; x.beginPath(); x.moveTo(X(g), T - 2); x.lineTo(X(g), B); x.stroke(); x.setLineDash([]); };
    vline(Q.cost, [2, 3], P.accent);
    label(x, gt(Q.cost), X(Q.cost) - 30, T + 10, P.accent, 12, 700);
    if (s > 0.02) {
      const g = Math.max(Q.cost, paid);
      vline(g, [6, 4], P.accent2);
      if (X(g) - X(Q.cost) > 34) label(x, gt(s > 0.98 ? Q.sec : g), X(g) + 5, T + 10, P.accent2, 12, 700);
      if (s > 0.98) {
        x.font = "700 26px Fraunces, Georgia, serif"; x.fillStyle = P.accent2;
        const txt = "×" + (Q.sec / Q.cost).toFixed(1), tw = x.measureText(txt).width;
        x.fillText(txt, Math.min(R - tw - 4, X(g) + 10), Yp(-220));
        label(x, "with security value", Math.min(R - 112, X(g) + 10), Yp(-220) + 18, P.accent2, 11, 600);
      }
    }
    // legend: in the HTML below the chart, aligned with the map legend
    // caption chip
    const msg = s < 0.02 ? `${yr} costs · fuel cost alone` : s < 0.98 ? `${yr} costs · subtract security margin` : `${yr} costs · abatement that pays off ×${(Q.sec / Q.cost).toFixed(1)}`;
    const col = s < 0.02 ? P.accent : P.accent2;
    x.font = "600 12.5px Inter, sans-serif"; const tw = x.measureText(msg).width;
    x.fillStyle = rgba(col, 0.12); x.beginPath(); x.roundRect ? x.roundRect(16, 12, tw + 20, 24, 12) : x.rect(16, 12, tw + 20, 24); x.fill();
    x.fillStyle = col; x.fillText(msg, 26, 29);
  }
  let visible = true, raf = 0;
  if ("IntersectionObserver" in window)
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible && !reduce) run(); }, { rootMargin: "100px" }).observe(cv);
  function run() { cancelAnimationFrame(raf); (function loop() { if (!visible) return; draw(); raf = requestAnimationFrame(loop); })(); }
  window.addEventListener("resize", draw);
  if (reduce) draw(); else run();
})();
