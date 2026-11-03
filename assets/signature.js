/* Animated panels for the signature contributions (Signature Work page; sig1-sig5, plus the left/middle panels
   sig1a offline reference learning, sig2a three ways to handle P(u), sig3a monotone stepwise bids and
   sig3b one-dimensional value functions, defined after panel 4).
   1  Prediction-free, explainable storage control: close up, the state of charge is decided hour by hour
      with no forecast while tracking an interpretable reference; the view then zooms out to a full year,
      where the online trajectory nearly coincides with the hindsight optimum.
   2  Decision-dependent uncertainty: a scenario fan whose spread depends on the decision u, with the
      end-of-horizon distribution drawn sideways on the right; the tail beyond the limit (violation
      probability) is shaded and compared with the target epsilon. The decision sweeps on its own and
      follows the pointer on hover.
   3  Storage bid bounds with privacy: a clearing-price path, a provable bound corridor around it, storage
      bids arriving; bids outside are pulled into the corridor; an inset shows the welfare gap converging.
   Colors come from the site's CSS variables (light and dark themes). Respects prefers-reduced-motion and
   pauses when the section is off screen. */
(function () {
  const cvs = ["sig1", "sig2", "sig3", "sig4", "sig5", "sig1a", "sig2a", "sig3a", "sig3b", "sig4b"].map((id) => document.getElementById(id));
  if (!cvs[0] || !cvs[1] || !cvs[2] || !cvs[3] || !cvs[5] || !cvs[6] || !cvs[7] || !cvs[8] || !cvs[9]) return;   // sig5 (energy security) is an image now
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const WARM = "#e0703a";

  function pal() {
    const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
    return { accent: v("--accent"), accent2: v("--accent-2"), ink: v("--ink"), ink2: v("--ink-2"), ink3: v("--ink-3"),
             line: v("--line"), card: v("--card"), soft: v("--bg-soft") };
  }
  function fit(c) {
    const r = c.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    if (c.width !== Math.round(r.width * d) || c.height !== Math.round(r.height * d)) {
      c.width = Math.round(r.width * d); c.height = Math.round(r.height * d);
    }
    const x = c.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0);
    return [x, r.width, r.height];
  }
  function rgba(col, a) {
    if (!col.startsWith("#")) return col;
    const h = col.length === 4 ? col.replace(/#(.)(.)(.)/, "#$1$1$2$2$3$3") : col;
    const n = parseInt(h.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function grid(x, w, h, P) {
    x.strokeStyle = rgba(P.ink3, 0.10); x.lineWidth = 1;
    for (let gx = 0; gx <= w; gx += 32) { x.beginPath(); x.moveTo(gx + 0.5, 0); x.lineTo(gx + 0.5, h); x.stroke(); }
    for (let gy = 0; gy <= h; gy += 32) { x.beginPath(); x.moveTo(0, gy + 0.5); x.lineTo(w, gy + 0.5); x.stroke(); }
  }
  function smooth(x, pts) {
    x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      x.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const l = pts[pts.length - 1]; x.lineTo(l[0], l[1]);
  }
  function tag(x, txt, px, py, col, size) {
    x.font = `italic ${size || 14}px Fraunces, Georgia, serif`; x.fillStyle = col; x.fillText(txt, px, py);
  }
  function label(x, txt, px, py, col, size, weight) {
    x.font = `${weight || 500} ${size || 12}px Inter, sans-serif`; x.fillStyle = col; x.fillText(txt, px, py);
  }
  function halo(x, col, wide, thin, path) {
    x.lineCap = "round"; x.lineJoin = "round";
    x.strokeStyle = rgba(col, 0.16); x.lineWidth = wide; path(); x.stroke();
    x.strokeStyle = col; x.lineWidth = thin; path(); x.stroke();
  }
  // axis lines with a rotated y label and an x label at the right end
  const PL = 46, PT = 64;   // shared plot frame: left axis and top of every chart, so panels in a row line up
  function axes(x, P, L, T, R, B, xl, yl) {
    x.strokeStyle = rgba(P.ink3, 0.7); x.lineWidth = 1;
    x.beginPath(); x.moveTo(L, T); x.lineTo(L, B); x.lineTo(R, B); x.stroke();
    x.font = "600 11px Inter, sans-serif"; x.fillStyle = P.ink2;
    if (xl) { const tw = x.measureText(xl).width; x.fillText(xl, (L + R - tw) / 2, B + 15); }
    if (yl) { const tw = x.measureText(yl).width; x.save(); x.translate(L - 30, (T + B) / 2 + tw / 2); x.rotate(-Math.PI / 2); x.fillText(yl, 0, 0); x.restore(); }
  }
  // standard normal tail P(Z > z) (Abramowitz-Stegun)
  function tail(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z >= 0 ? p : 1 - p;
  }

  /* ---------- 1: prediction-free, explainable storage control (zoom from hours to a year) ---------- */
  // One synthetic year of hourly operation. Close up, the online controller decides hour by hour with no
  // forecast, tracking the learned SOC reference; the view then zooms out to the whole year, where the
  // hindsight-optimal trajectory (perfect foresight) is drawn in and nearly coincides with the online one.
  const NH = 8760, R1 = new Float32Array(NH), H1 = new Float32Array(NH), O1 = new Float32Array(NH), PR1 = new Float32Array(NH);
  {
    let seed = 7, dz = 0;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const cl = (v) => Math.max(0.04, Math.min(0.96, v));
    for (let k = 0; k < NH; k++) {
      const tau = k / NH, day = 2 * Math.PI * k / 24;
      // the learned reference carries the same seasonal, monthly and daily shape as the hindsight optimum
      const season = 0.5 + 0.3 * Math.sin(2 * Math.PI * tau - 1.3), amp = 0.06 + 0.02 * Math.sin(4 * Math.PI * tau);
      H1[k] = cl(season + 0.045 * Math.sin(2 * Math.PI * tau * 12 + 0.4) + amp * Math.sin(day - 1.0));
      R1[k] = cl(season + 0.04 * Math.sin(2 * Math.PI * tau * 12 + 0.55) + 0.9 * amp * Math.sin(day - 1.15));
      // online tracking is loose on purpose: a slow drift plus a small daily lag around the reference
      dz = 0.996 * dz + (rnd() - 0.5) * 0.006;
      O1[k] = cl(R1[k] + dz + 0.022 * Math.sin(day + 0.9) + 0.012 * Math.sin(2 * Math.PI * tau * 30 + 1));
      PR1[k] = Math.max(0.03, Math.min(1, 0.45 + 0.28 * Math.sin(day - 2.0) + 0.12 * Math.sin(2 * Math.PI * tau + 0.6) + 0.14 * (rnd() - 0.5)));
    }
  }
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MDAY = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let t1 = 0, k0 = 900, nextK0 = 900, view1 = { ph: 0, head: 900, W: 72 };
  const ease = (s) => { const k = Math.max(0, Math.min(1, s)); return k * k * (3 - 2 * k); };
  { const z = /[?&]z1=(\d+)/.exec(location.search); if (z) t1 = +z[1]; }   // ?z1=600 jumps into the cycle (previews)
  function step1() { t1 += 1; }
  function window1() {
    const cyc = reduce ? 600 : t1 % 870, W0 = 72, logZ = Math.log(NH / W0);
    if (cyc === 0) k0 = nextK0;
    if (cyc === 750) nextK0 = 300 + Math.floor(Math.random() * 7900);
    const zoom = (s, anchor) => {      // s = 0: close-up ending at anchor; s = 1: the whole year
      const W = W0 * Math.exp(logZ * s);   // "now" stays at 45% of the window, so the unseen future shows on its right
      let a = anchor - 0.45 * W, b = a + W;
      if (a < 0) { b -= a; a = 0; } if (b > NH) { a -= b - NH; b = NH; }
      return [a, b, W];
    };
    if (cyc < 300) { const head = k0 + cyc * 0.25, [a, b, W] = zoom(0, head); return { ph: 0, a, b, W, head, fut: 0, hind: 0 }; }
    if (cyc < 450) { const s = ease((cyc - 300) / 150), head = k0 + 75, [a, b, W] = zoom(s, head); return { ph: 1, a, b, W, head, fut: s, hind: 0 }; }
    if (cyc < 750) return { ph: 2, a: 0, b: NH, W: NH, head: k0 + 75, fut: 1, hind: ease((cyc - 450) / 200) };
    const s = 1 - ease((cyc - 750) / 120), [a, b, W] = zoom(s, nextK0);
    return { ph: 3, a, b, W, head: nextK0, fut: s, hind: s };
  }
  // sample a series over [a, b] (hours) up to kmax: hourly points when zoomed in, per-pixel mean and range when out
  function series(arr, a, b, k1, k2, X, n) {
    const pts = [], lo = [], hi = [], hp = (b - a) / n;
    if (hp <= 1.5) {
      for (let k = Math.max(k1, Math.floor(a)); k <= Math.min(k2, Math.ceil(b), NH - 1); k++) pts.push([X(k), arr[k], k]);
      return { pts, lo, hi, fine: true };
    }
    for (let c = 0; c < n; c++) {
      const s0 = Math.max(k1, Math.floor(a + c * hp)), s1 = Math.min(k2, Math.floor(a + (c + 1) * hp), NH - 1);
      if (s1 < s0) continue;
      let m = 0, mn = 1, mx = 0;
      for (let k = s0; k <= s1; k++) { const v = arr[k]; m += v; if (v < mn) mn = v; if (v > mx) mx = v; }
      const px = X((s0 + s1) / 2); pts.push([px, m / (s1 - s0 + 1)]); lo.push([px, mn]); hi.push([px, mx]);
    }
    return { pts, lo, hi, fine: false };
  }
  function draw1() {
    const [x, w, h] = fit(cvs[0]), P = pal();
    x.clearRect(0, 0, w, h); grid(x, w, h, P);
    const gw = 52, L = PL, R = w - gw - 34, T = PT, B = h - 52, v = (view1 = window1());
    axes(x, P, L, T - 6, R, B, "time (hour → year)", "state of charge");
    const X = (k) => L + (R - L) * (k - v.a) / (v.b - v.a), Y = (s) => B - (B - T) * s, n = Math.round(R - L);
    x.save(); x.beginPath(); x.rect(L - 2, T - 30, R - L + 4, B - T + 34); x.clip();
    // calendar: day lines close up, month lines zoomed out
    x.font = "600 10.5px Inter, sans-serif"; x.lineWidth = 1;
    if (v.W <= 24 * 20) for (let d = Math.ceil(v.a / 24); d * 24 <= v.b; d++) {
      x.strokeStyle = rgba(P.ink3, 0.28); x.beginPath(); x.moveTo(X(d * 24), T); x.lineTo(X(d * 24), B); x.stroke();
      if (v.W <= 24 * 6 && X(d * 24) + 48 < R) { x.fillStyle = P.ink3; x.fillText("day " + (d + 1), X(d * 24) + 4, T + 12); }
    }
    if (v.W >= 24 * 45) MDAY.forEach((d, i) => {
      const px = X(d * 24); if (px < L - 1 || px > R) return;
      x.strokeStyle = rgba(P.ink3, 0.28); x.beginPath(); x.moveTo(px, T); x.lineTo(px, B); x.stroke();
      if (v.W >= 24 * 150) { x.fillStyle = P.ink3; x.fillText(MONTHS[i], px + 4, T + 12); }
    });
    // hourly prices, unknown ahead: visible close up, fading as the view widens
    const pa = Math.max(0, 1 - Math.log(v.W / 72) / Math.log(8));
    if (pa > 0.01) {
      const top = v.ph === 0 ? v.head : NH - 1, bwid = Math.max(1.2, (R - L) / v.W * 0.62);
      for (let k = Math.max(0, Math.floor(v.a)); k <= Math.min(top, v.b); k++) {
        const q = PR1[k]; x.fillStyle = rgba(P.ink3, (0.16 + 0.3 * q) * pa);
        x.fillRect(X(k) - bwid / 2, B - (B - T) * 0.32 * q, bwid, (B - T) * 0.32 * q);
      }
    }
    // the future is unseen: shaded beyond "now" (prices unknown, no forecast); lifts as the year completes
    const fa = 1 - v.fut, fx = X(v.head) + 7;
    if (fa > 0.02 && fx < R) {
      const g = x.createLinearGradient(fx, 0, Math.min(R, fx + 70), 0);
      g.addColorStop(0, rgba(P.ink3, 0.04 * fa)); g.addColorStop(1, rgba(P.ink3, 0.17 * fa));
      x.fillStyle = g; x.fillRect(fx, T - 30, R - fx + 4, B - T + 34);
      x.globalAlpha = fa;
      x.font = "700 30px Fraunces, Georgia, serif"; x.fillStyle = rgba(P.ink2, 0.75);   // one bouncing question mark
      const qw = x.measureText("?").width;
      if (R - fx > qw + 12) x.fillText("?", (fx + R - qw) / 2, (T + B) / 2 + 10 - 14 * Math.abs(Math.sin(t1 / 14)));
      x.font = "italic 14px Fraunces, Georgia, serif";
      const msg = "future unseen", mw = x.measureText(msg).width;
      if (R - fx > mw + 20) { x.fillStyle = P.ink2; x.fillText(msg, (fx + R - mw) / 2, T + 26); }
      x.setLineDash([3, 4]); x.strokeStyle = rgba(P.ink2, 0.7); x.lineWidth = 1.2;
      x.beginPath(); x.moveTo(fx - 7, T - 4); x.lineTo(fx - 7, B); x.stroke(); x.setLineDash([]);
      label(x, "now", fx - 3, B - 6, P.ink2, 11, 700);
      x.globalAlpha = 1;
    }
    // learned SOC reference and its tracking band
    const rs = series(R1, v.a, v.b, 0, NH - 1, X, Math.min(n, 240));
    x.fillStyle = rgba(P.accent2, 0.12); x.beginPath();
    rs.pts.forEach(([px, s], i) => (i ? x.lineTo(px, Y(s + 0.07)) : x.moveTo(px, Y(s + 0.07))));
    for (let i = rs.pts.length - 1; i >= 0; i--) x.lineTo(rs.pts[i][0], Y(rs.pts[i][1] - 0.07)); x.fill();
    x.setLineDash([6, 6]); x.strokeStyle = rgba(P.accent2, 0.95); x.lineWidth = 1.6;
    x.beginPath(); rs.pts.forEach(([px, s], i) => (i ? x.lineTo(px, Y(s)) : x.moveTo(px, Y(s)))); x.stroke(); x.setLineDash([]);
    // online SOC: up to now in full, the rest of the year fades in as the view zooms out
    const head = Math.floor(v.head);
    [[0, head, 1], [head, NH - 1, v.fut]].forEach(([k1, k2, al]) => {
      if (al < 0.02) return;
      const os = series(O1, v.a, v.b, k1, k2, X, n);
      if (os.pts.length < 2) return;
      x.globalAlpha = al;
      if (!os.fine) {   // daily cycling shows as a band when zoomed out
        x.fillStyle = rgba(P.accent, 0.16); x.beginPath();
        os.hi.forEach(([px, s], i) => (i ? x.lineTo(px, Y(s)) : x.moveTo(px, Y(s))));
        for (let i = os.lo.length - 1; i >= 0; i--) x.lineTo(os.lo[i][0], Y(os.lo[i][1])); x.fill();
      }
      const sp = os.pts.map(([px, s]) => [px, Y(s)]);
      halo(x, P.accent, os.fine ? 10 : 7, os.fine ? 3 : 2.4, () => smooth(x, sp));
      if (os.fine && k1 === 0) { x.fillStyle = P.accent; sp.forEach(([px, py]) => { x.beginPath(); x.arc(px, py, 1.9, 0, 7); x.fill(); }); }
      x.globalAlpha = 1;
    });
    // hindsight optimum (perfect foresight), drawn in once the whole year is in view
    const kh = Math.floor(v.hind * (NH - 1));
    let hs = null;
    if (v.hind > 0) {
      hs = series(H1, v.a, v.b, 0, kh, X, n);
      const hp = () => { x.beginPath(); hs.pts.forEach(([px, s], i) => (i ? x.lineTo(px, Y(s)) : x.moveTo(px, Y(s)))); };
      x.strokeStyle = rgba(P.card, 0.85); x.lineWidth = 4; hp(); x.stroke();
      x.setLineDash([6, 4]); x.strokeStyle = WARM; x.lineWidth = 2; hp(); x.stroke(); x.setLineDash([]);
    }
    // current decision
    if (v.ph !== 2) {
      const px = X(head), py = Y(O1[head]);
      x.fillStyle = P.accent; x.beginPath(); x.arc(px, py, 5.5, 0, 7); x.fill();
      x.strokeStyle = rgba(P.accent, 0.35); x.lineWidth = 1.6; x.beginPath(); x.arc(px, py, 10 + 3 * Math.sin(t1 / 6), 0, 7); x.stroke();
    }
    x.restore();
    // time window readout
    const days = v.W / 24, win = days < 2.5 ? Math.round(v.W) + " hours" : days < 60 ? Math.round(days) + " days"
              : days < 340 ? Math.round(days / 30.4) + " months" : "1 year";
    x.font = "600 11.5px Inter, sans-serif"; const ww = x.measureText("window: " + win).width;
    label(x, "window: " + win, R - ww, T - 10, P.ink3, 11.5, 600);
    // battery gauge
    const bx = w - gw - 12, by = T + 6, bh = B - T - 12, bw = gw - 18, lv = O1[head];
    x.strokeStyle = P.ink2; x.lineWidth = 1.8; x.strokeRect(bx, by, bw, bh);
    x.fillStyle = P.ink2; x.fillRect(bx + bw / 2 - 7, by - 6, 14, 6);
    x.fillStyle = rgba(P.accent, 0.85); x.fillRect(bx + 4, by + 4 + (bh - 8) * (1 - lv), bw - 8, (bh - 8) * lv);
    label(x, Math.round(lv * 100) + "%", bx + 2, B + 16, P.ink3, 12);
    // legend
    let lx = L;
    [["prices, unknown ahead", P.ink3, pa > 0.3], ["SOC reference", P.accent2, true], ["online SOC", P.accent, true],
     ["hindsight optimum", WARM, v.hind > 0.05]].forEach(([txt, col, on]) => {
      if (!on) return; tag(x, txt, lx, B + 38, col, 13.5); lx += x.measureText(txt).width + 16;
    });
  }

  /* ---------- 2: decision-dependent uncertainty ---------- */
  let hoverU = null, t2 = 0, uNow = 0.5;
  cvs[1].addEventListener("pointermove", (e) => {
    const r = cvs[1].getBoundingClientRect(); hoverU = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  });
  cvs[1].addEventListener("pointerleave", () => { hoverU = null; });
  // scenario seeds: a standard-normal level (Box-Muller) plus small wiggles, so the share of scenarios that
  // cross the bound matches the shaded tail probability
  const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  const seeds = Array.from({ length: 40 }, () => [gauss(), ...Array.from({ length: 5 }, () => Math.random() * 2 - 1)]);
  function draw2() {
    const [x, w, h] = fit(cvs[1]), P = pal();
    x.clearRect(0, 0, w, h); grid(x, w, h, P);
    t2 += 1;
    const target = hoverU !== null ? hoverU : 0.5 + 0.45 * Math.sin(t2 / 150);
    uNow += (target - uNow) * 0.08;
    const u = uNow;
    const L = PL, DW = Math.min(150, w * 0.2), R = w - DW - 28, T = PT, B = h - 54, N = 110;
    const x0 = L + (R - L) * 0.18, lim = T + (B - T) * 0.10;
    axes(x, P, L, T - 6, R, B + 6, "time", "uncertainty ξ");
    const X = (k) => x0 + (R - x0) * k;
    const mean = (k) => B - (B - T) * (0.30 + 0.16 * k + 0.20 * u * k + 0.035 * Math.sin(k * 5 + t2 / 60));
    const sig = (k) => (B - T) * (0.025 + 0.20 * u * k + 0.02 * k);
    // past
    const past = []; for (let i = 0; i <= 24; i++) past.push([L + (x0 - L) * i / 24, B - (B - T) * (0.30 + 0.05 * Math.sin(i / 3 + t2 / 70))]);
    x.strokeStyle = P.ink2; x.lineWidth = 2.2; smooth(x, past); x.stroke();
    x.setLineDash([3, 4]); x.strokeStyle = rgba(P.ink3, 0.6); x.lineWidth = 1;
    x.beginPath(); x.moveTo(x0, T - 10); x.lineTo(x0, B + 6); x.stroke(); x.setLineDash([]);
    label(x, "now", x0 + 5, B - 4, P.ink3, 11);
    // everything inside the chart frame
    x.save(); x.beginPath(); x.rect(L, T - 6, R - L, B + 12 - T); x.clip();
    // quantile bands
    [[1.96, 0.08], [1.28, 0.11], [0.67, 0.15]].forEach(([z, a]) => {
      x.fillStyle = rgba(P.accent, a); x.beginPath();
      for (let i = 0; i <= N; i++) { const k = i / N; x.lineTo(X(k), mean(k) - z * sig(k)); }
      for (let i = N; i >= 0; i--) { const k = i / N; x.lineTo(X(k), mean(k) + z * sig(k)); }
      x.fill();
    });
    // scenarios (first crossing of the limit is marked as a bound violation)
    const hits = [];
    seeds.forEach((sd) => {
      const pts = []; let crossed = false;
      for (let i = 0; i <= N; i++) {
        const k = i / N;
        const z = sd[0] * Math.min(1, 0.25 + k) + 0.22 * (sd[1] * Math.sin(k * 6 + sd[2] * 3) + sd[3] * Math.sin(k * 11 + sd[4] * 5));
        const y = mean(k) - z * sig(k);
        if (y < lim && !crossed) { crossed = true; hits.push([X(k), lim]); }
        pts.push([X(k), y]);
      }
      x.strokeStyle = crossed ? rgba(WARM, 0.85) : rgba(P.accent, 0.30); x.lineWidth = crossed ? 1.6 : 1;
      smooth(x, pts); x.stroke();
      if (crossed) { const e = pts[pts.length - 1]; x.fillStyle = WARM; x.beginPath(); x.arc(e[0], e[1], 2.2, 0, 7); x.fill(); }
    });
    const mp = []; for (let i = 0; i <= N; i++) { const k = i / N; mp.push([X(k), mean(k)]); }
    halo(x, P.accent, 9, 2.8, () => smooth(x, mp));
    x.restore();
    // limit and bound violations
    x.setLineDash([7, 6]); x.strokeStyle = P.ink; x.lineWidth = 1.3;
    x.beginPath(); x.moveTo(L, lim); x.lineTo(w - 14, lim); x.stroke(); x.setLineDash([]);
    tag(x, "bound", L, lim - 8, P.ink2, 13);
    hits.forEach(([hx, hy]) => {
      x.strokeStyle = WARM; x.lineWidth = 2.2; x.lineCap = "round";
      x.beginPath(); x.moveTo(hx - 5, hy - 5); x.lineTo(hx + 5, hy + 5); x.moveTo(hx + 5, hy - 5); x.lineTo(hx - 5, hy + 5); x.stroke();
    });
    if (hits.length) tag(x, hits.length + (hits.length === 1 ? " bound violation" : " bound violations"), Math.min(R - 150, hits[0][0] + 10), lim + 20, WARM, 13);
    // end-of-horizon density drawn sideways, tail beyond the limit shaded
    const mu = mean(1), sd = sig(1), dx0 = R + 18;
    const dens = (y) => Math.exp(-0.5 * ((y - mu) / sd) ** 2);
    x.beginPath(); x.moveTo(dx0, T - 20);
    for (let y = T - 20; y <= B + 10; y += 2) x.lineTo(dx0 + DW * 0.85 * dens(y), y);
    x.lineTo(dx0, B + 10); x.closePath(); x.fillStyle = rgba(P.accent, 0.16); x.fill();
    x.beginPath(); x.moveTo(dx0, T - 20);
    for (let y = T - 20; y <= lim; y += 1) x.lineTo(dx0 + DW * 0.85 * dens(y), y);
    x.lineTo(dx0, lim); x.closePath(); x.fillStyle = rgba(WARM, 0.55); x.fill();
    x.beginPath(); for (let y = T - 20; y <= B + 10; y += 2) { const xx = dx0 + DW * 0.85 * dens(y); y === T - 20 ? x.moveTo(xx, y) : x.lineTo(xx, y); }
    x.strokeStyle = P.accent; x.lineWidth = 1.6; x.stroke();
    x.strokeStyle = rgba(P.ink3, 0.7); x.lineWidth = 1; x.beginPath(); x.moveTo(dx0, T - 20); x.lineTo(dx0, B + 10); x.stroke();
    // name the sideways curve: the end-of-horizon distribution of ξ, which depends on u
    x.font = "italic 13px Fraunces, Georgia, serif"; x.lineWidth = 3.5; x.strokeStyle = rgba(P.card, 0.9); x.lineJoin = "round";
    [["distribution", 15], ["ξ ∼ P(u)", 30]].forEach(([txt, yy]) => {
      x.strokeText(txt, dx0 + 8, yy); x.fillStyle = P.accent; x.fillText(txt, dx0 + 8, yy);
    });
    const risk = 100 * tail((mu - lim) / sd);
    const ok = risk <= 5;
    label(x, "violation prob.", dx0 + 4, B + 22, P.ink3, 11);
    label(x, risk.toFixed(1) + "%", dx0 + 4, B + 40, ok ? P.accent2 : WARM, 15, 700);
    label(x, ok ? "≤ ε = 5%" : "> ε = 5%", dx0 + 58, B + 40, ok ? P.accent2 : WARM, 11.5, 600);
    // decision slider
    const sy = h - 18, sx0 = L, sx1 = R;
    x.strokeStyle = rgba(P.ink3, 0.5); x.lineWidth = 3; x.lineCap = "round";
    x.beginPath(); x.moveTo(sx0, sy); x.lineTo(sx1, sy); x.stroke();
    x.strokeStyle = P.accent2; x.beginPath(); x.moveTo(sx0, sy); x.lineTo(sx0 + (sx1 - sx0) * u, sy); x.stroke();
    const kx = sx0 + (sx1 - sx0) * u;
    x.fillStyle = P.card; x.strokeStyle = P.accent2; x.lineWidth = 2.4;
    x.beginPath(); x.arc(kx, sy, 7.5, 0, 7); x.fill(); x.stroke();
    tag(x, "decision u", sx0, sy - 12, P.accent2, 13);
  }

  /* ---------- 3: storage market power: detection, then mitigation with bid bounds ---------- */
  // Discharge offers (s = +1, ▲) sit between the clearing price and the discharge bound b̄ above it; charge bids
  // (s = -1, ▼) sit between the charge bound b̲ and the clearing price. Withholding = a discharge offer above b̄
  // or a charge bid below b̲ (f > 1). Two phases:
  //   ① detection: the bounds are only a yardstick; withholding grows, and so does the welfare loss;
  //   ② mitigation: the bounds are enforced; withholding attempts continue but are capped at the bound, so the
  //      welfare loss (the summed orange excess beyond the bounds) falls to zero.
  let bids = [], t3 = 0, loss3 = 0;
  { const z = /[?&]z3=(\d+)/.exec(location.search); if (z) t3 = +z[1]; }   // ?z3=300 jumps into the cycle (previews)
  const N3 = 140, gapHist = [], C3 = 720, SW3 = 400;   // cycle length and the frame where the bounds switch on
  const newBid = (q, prog) => {
    const wh = Math.random() < 0.06 + 0.5 * prog;   // withholding becomes more frequent and deeper during ①
    return { q, s: Math.random() < 0.5 ? 1 : -1, f: wh ? 1.2 + (0.3 + 0.9 * prog) * Math.random() : 0.2 + 0.7 * Math.random() };
  };
  for (let k = 0; k < 16; k++) bids.push(newBid(Math.random(), 0));
  if (t3) for (let k = t3 - 260; k < t3; k++) {   // after a ?z3 jump, replay the bid stream so the screen matches the phase
    const c = ((k % C3) + C3) % C3;
    if (c === 0) bids.forEach((b) => { if (b.f > 1) b.f = 0.2 + 0.7 * Math.random(); });
    if (Math.random() < 0.11) bids.push(newBid(1.02, c >= SW3 ? 1 : c / SW3));
    bids.forEach((b) => (b.q -= 0.004)); bids = bids.filter((b) => b.q > -0.02);
  }
  function tri(x, px, py, s, r) {
    x.beginPath(); x.moveTo(px, py - s * r); x.lineTo(px + r * 0.95, py + s * r * 0.65); x.lineTo(px - r * 0.95, py + s * r * 0.65); x.closePath();
  }
  function draw3() {
    const [x, w, h] = fit(cvs[2]), P = pal();
    x.clearRect(0, 0, w, h); grid(x, w, h, P);
    t3 += 1;
    const cyc = reduce ? 600 : t3 % C3, on = cyc >= SW3;
    const prog = on ? 1 : cyc / SW3;                              // withholding pressure
    const enf = on ? ease((cyc - SW3) / 45) : 0;                  // how strongly the bounds hold
    const flash = on && cyc - SW3 < 50 ? 1 - (cyc - SW3) / 50 : 0;
    const IW = Math.min(170, w * 0.24), L = PL, R = w - IW - 34, T = PT, B = h - 62;
    axes(x, P, L, T - 6, R, B, "time", "price ($/MWh)");
    const X = (q) => L + (R - L) * q;
    const pr = (q) => T + (B - T) * (0.46 + 0.16 * Math.sin(q * 6.5 + t3 / 110) + 0.06 * Math.sin(q * 17 + t3 / 50));
    const bw = (q) => (B - T) * (0.15 + 0.03 * Math.sin(q * 9 + t3 / 80));
    x.save(); x.beginPath(); x.rect(L, T - 6, R - L, B + 6 - T); x.clip();
    // bounds: a faint dashed yardstick during detection, solid and enforced during mitigation
    x.fillStyle = rgba(P.accent2, 0.06 + 0.12 * enf); x.beginPath();
    for (let i = 0; i <= N3; i++) { const q = i / N3; x.lineTo(X(q), pr(q) - bw(q)); }
    for (let i = N3; i >= 0; i--) { const q = i / N3; x.lineTo(X(q), pr(q) + bw(q)); } x.fill();
    [-1, 1].forEach((sg) => {
      const pts = []; for (let i = 0; i <= N3; i++) { const q = i / N3; pts.push([X(q), pr(q) + sg * bw(q)]); }
      if (flash > 0) { x.strokeStyle = rgba(P.accent2, 0.25 * flash); x.lineWidth = 10; smooth(x, pts); x.stroke(); }
      x.setLineDash(on ? [] : [6, 5]); x.strokeStyle = rgba(P.accent2, on ? 1 : 0.7); x.lineWidth = on ? 2.4 : 1.4;
      smooth(x, pts); x.stroke(); x.setLineDash([]);
    });
    const pp = []; for (let i = 0; i <= N3; i++) { const q = i / N3; pp.push([X(q), pr(q)]); }
    x.setLineDash([4, 5]); x.strokeStyle = rgba(P.ink2, 0.8); x.lineWidth = 1.3; smooth(x, pp); x.stroke(); x.setLineDash([]);
    // bids
    if (cyc === 0) bids.forEach((b) => { if (b.f > 1) b.f = 0.2 + 0.7 * Math.random(); });   // new cycle starts clean
    if (!reduce && Math.random() < 0.11) bids.push(newBid(1.02, prog));
    bids.forEach((b) => (b.q -= 0.004)); bids = bids.filter((b) => b.q > -0.02);
    const flag = { 1: null, "-1": null };
    let excess = 0;
    bids.forEach((b) => {
      const p0 = pr(b.q), half = bw(b.q), yRaw = Math.max(T, Math.min(B - 4, p0 - b.s * half * b.f));
      const tgt = p0 - b.s * half * Math.min(b.f, 1), out = b.f > 1 && b.q < 1;
      const y = out ? yRaw + (tgt - yRaw) * enf : yRaw, px = X(b.q), ex = Math.abs(y - tgt);
      const hot = out && ex > 2;
      if (hot) {   // the excess beyond the bound is the welfare loss this bid causes
        excess += ex;
        if (!flag[b.s] || b.q > flag[b.s][0]) flag[b.s] = [b.q, y];
        x.strokeStyle = rgba(WARM, 0.85); x.lineWidth = 2.6; x.lineCap = "round";
        x.beginPath(); x.moveTo(px, tgt); x.lineTo(px, y); x.stroke();
      } else if (out && enf > 0.5) {   // attempted withholding, capped at the bound
        x.strokeStyle = rgba(WARM, 0.35); x.lineWidth = 1; x.setLineDash([2, 3]);
        x.beginPath(); x.moveTo(px, yRaw); x.lineTo(px, tgt); x.stroke(); x.setLineDash([]);
        tri(x, px, yRaw, b.s, 4); x.stroke();
      }
      const col = hot ? WARM : b.s > 0 ? P.accent : P.accent2;
      x.fillStyle = rgba(col, 0.16); x.beginPath(); x.arc(px, y, 8.5, 0, 7); x.fill();
      x.fillStyle = col; tri(x, px, y, b.s, 5.2); x.fill();
    });
    [[1, "discharge withholding"], [-1, "charge withholding"]].forEach(([s, txt]) => {
      const f = flag[s]; if (!f) return;
      x.font = "italic 13px Fraunces, Georgia, serif";
      const tw = x.measureText(txt).width, fx = Math.min(R - tw, Math.max(L, X(f[0]) - tw / 2));
      tag(x, txt, fx, s > 0 ? Math.max(T + 12, f[1] - 12) : Math.min(B - 6, f[1] + 20), WARM, 13);
    });
    x.restore();
    // which bound is which (price rises upward)
    x.font = "600 11.5px Inter, sans-serif"; x.lineWidth = 3.5; x.strokeStyle = rgba(P.card, 0.9); x.lineJoin = "round";
    [["discharge bid bound  b̄", pr(0.02) - bw(0.02) - 7], ["charge bid bound  b̲", pr(0.02) + bw(0.02) + 16]].forEach(([txt, yy]) => {
      x.strokeText(txt, L + 6, yy); x.fillStyle = P.accent2; x.fillText(txt, L + 6, yy);
    });
    // inset: welfare loss = the summed orange excess on the left, over one detection-then-mitigation cycle
    loss3 += (Math.min(1, excess / ((B - T) * 1.5)) - loss3) * 0.08;
    if (cyc === 0) gapHist.length = 0;
    const NI = 120, cur = Math.floor(cyc / (C3 / NI));
    gapHist[cur] = loss3;
    const ix = R + 26, iy = T, ih = B - T - 40, gx0 = ix + 10, gx1 = ix + IW - 10;
    x.fillStyle = rgba(P.card, 0.9); x.strokeStyle = rgba(P.ink3, 0.5); x.lineWidth = 1;
    x.beginPath(); x.roundRect ? x.roundRect(ix, iy, IW, ih, 8) : x.rect(ix, iy, IW, ih); x.fill(); x.stroke();
    label(x, "welfare loss", ix + 10, iy + 18, WARM, 11.5, 700);
    if (IW >= 150) label(x, "= sum of orange excess", ix + 10, iy + 33, P.ink3, 10.5);
    const gx = (i) => gx0 + (gx1 - gx0) * i / (NI - 1), gy = (v) => iy + ih - 12 - (ih - 64) * v, sw = SW3 / (C3 / NI);
    [[0, sw, rgba(WARM, 0.09), "① detect", !on], [sw, NI - 1, rgba(P.accent2, 0.12), "② mitigate", on]].forEach(([a, b, bg, n, act]) => {
      x.fillStyle = bg; x.fillRect(gx(a), iy + 42, gx(b) - gx(a), gy(0) - iy - 42);
      label(x, n, gx(a) + 4, iy + 55, act ? P.ink : P.ink3, 10.5, 700);
    });
    x.strokeStyle = rgba(P.accent2, 0.9); x.lineWidth = 1.4; x.setLineDash([3, 3]);
    x.beginPath(); x.moveTo(gx(sw), iy + 42); x.lineTo(gx(sw), gy(0)); x.stroke(); x.setLineDash([]);
    x.strokeStyle = rgba(P.ink3, 0.4); x.lineWidth = 1; x.beginPath(); x.moveTo(gx0, gy(0)); x.lineTo(gx1, gy(0)); x.stroke();
    x.beginPath(); let started = false;
    gapHist.forEach((v, i) => { if (v === undefined) return; started ? x.lineTo(gx(i), gy(v)) : x.moveTo(gx(i), gy(v)); started = true; });
    if (started) {
      x.strokeStyle = WARM; x.lineWidth = 2.2; x.stroke();
      x.fillStyle = WARM; x.beginPath(); x.arc(gx(cur), gy(loss3), 3.5, 0, 7); x.fill();
    }
    label(x, "→ 0", ix + IW - 34, gy(0) - 6, P.accent2, 12, 600);
    // lock
    const lx = ix + IW / 2 - 10, ly = iy + ih + 12;
    x.strokeStyle = P.ink2; x.lineWidth = 2; x.beginPath(); x.arc(lx + 10, ly + 8, 6, Math.PI, 0); x.stroke();
    x.fillStyle = P.ink2; x.beginPath(); x.roundRect ? x.roundRect(lx + 2, ly + 8, 16, 13, 2) : x.rect(lx + 2, ly + 8, 16, 13); x.fill();
    { x.font = "700 11px Inter, sans-serif"; const tw = x.measureText("privacy-preserving").width;   // always shown under the lock
      label(x, "privacy-preserving", ix + (IW - tw) / 2, ly + 36, P.ink2, 11, 700); }
    // legend: ▲ discharge offer, ▼ charge bid, bounds, clearing price
    let lx2 = 16;
    [["discharge offer", P.accent, 1], ["charge bid", P.accent2, -1], ["bid bounds", P.accent2, 0], ["clearing price", P.ink2, 0]]
      .filter((e, i) => w >= 640 || i < 3).forEach(([txt, col, s]) => {
        if (s) { x.fillStyle = col; tri(x, lx2 + 5, B + 35, s, 5); x.fill(); lx2 += 14; }
        tag(x, txt, lx2, B + 40, col, 13);
        lx2 += x.measureText(txt).width + 14;
      });
  }

  /* ---------- 4: decision-focused learning for scenario reduction (two spaces, mapped back and forth) ---------- */
  // Left: scenarios in the uncertainty space. Right: the same scenarios in the decision space, i.e. where
  // each scenario sends the optimal decision and its cost. The cycle runs in three steps:
  //   (1) map every scenario to the decision space, (2) cluster there by decision impact,
  //   (3) map the representative of each cluster back. Scenarios that look alike in the uncertainty space
  //   can land in different decision clusters, which is why statistically typical scenarios are not enough.
  const N4 = 64, K4 = 4, CL = ["#2f6fd1", "#0f9c8f", "#e0703a", "#8a63d2"];
  const sc4 = [];
  const g4 = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
  for (let i = 0; i < N4; i++) {
    const a = g4() * 0.75, b = g4() * 0.75;
    // decision-space image: the optimal decision saturates in a and folds in b (nonlinear map)
    const d1 = Math.tanh(2.6 * (a + 0.3 * b)), d2 = Math.tanh(2.6 * (b - 0.35 * a * a + 0.08));
    sc4.push({ a, b, d1, d2, k: 0, ph: Math.random() * 6.28 });
  }
  // normalize the decision-space coordinates to [-1, 1] so the right panel is filled
  ["d1", "d2"].forEach((k) => {
    const v = sc4.map((p) => p[k]).sort((m, n) => m - n), lo = v[Math.floor(0.04 * v.length)], hi = v[Math.ceil(0.96 * v.length) - 1];
    sc4.forEach((p) => { p[k] = Math.max(-1.1, Math.min(1.1, 2 * (p[k] - lo) / (hi - lo || 1) - 1)); });
  });
  // k-means in the decision space (deterministic start), then the medoid of each cluster is its representative
  let cen = [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]];
  for (let it = 0; it < 12; it++) {
    sc4.forEach((p) => { let best = 0, bd = 1e9; cen.forEach(([u, v], k) => { const d = (p.d1 - u) ** 2 + (p.d2 - v) ** 2; if (d < bd) { bd = d; best = k; } }); p.k = best; });
    cen = cen.map(([u, v], k) => { const m = sc4.filter((p) => p.k === k); return m.length ? [m.reduce((s, p) => s + p.d1, 0) / m.length, m.reduce((s, p) => s + p.d2, 0) / m.length] : [u, v]; });
  }
  const reps = cen.map(([u, v], k) => { let best = null, bd = 1e9; sc4.forEach((p) => { if (p.k !== k) return; const d = (p.d1 - u) ** 2 + (p.d2 - v) ** 2; if (d < bd) { bd = d; best = p; } }); return best; });
  let t4 = 0;
  function draw4() {
    const [x, w, h] = fit(cvs[3]), P = pal();
    x.clearRect(0, 0, w, h); grid(x, w, h, P);
    t4 += 1;
    const cyc = t4 % 720, ph = cyc < 200 ? 0 : cyc < 400 ? 1 : cyc < 600 ? 2 : 3;
    const e = (s) => { const k = Math.max(0, Math.min(1, s)); return k * k * (3 - 2 * k); };
    const mapT = ph === 0 ? e(cyc / 170) : 1, clT = ph === 0 ? 0 : ph === 1 ? e((cyc - 200) / 120) : 1, backT = ph < 2 ? 0 : ph === 2 ? e((cyc - 400) / 140) : 1;
    const T = PT, B = h - 78, gap = 70, half = (w - PL - 16 - gap) / 2;
    const LB = [PL, T, PL + half, B], RB = [PL + half + gap, T, w - 16, B];
    // the two spaces
    [[LB, "uncertainty space  ξ"], [RB, "decision space  x*(ξ)"]].forEach(([[x0, y0, x1, y1], ttl]) => {
      x.fillStyle = rgba(P.card, 0.65); x.strokeStyle = rgba(P.ink3, 0.45); x.lineWidth = 1;
      x.beginPath(); x.roundRect ? x.roundRect(x0, y0, x1 - x0, y1 - y0, 10) : x.rect(x0, y0, x1 - x0, y1 - y0); x.fill(); x.stroke();
      tag(x, ttl, x0 + 4, y1 + 38, P.ink2, 13.5);
    });
    // each space is a chart: its frame edges are the axes
    [[LB, "ξ₁", "ξ₂"], [RB, "z₁*", "z₂*"]].forEach(([[x0, y0, x1, y1], ax, ay]) => {
      x.font = "600 11px Inter, sans-serif"; x.fillStyle = P.ink2;
      const tw = x.measureText(ax).width; x.fillText(ax, (x0 + x1 - tw) / 2, y1 + 15);
      x.save(); x.translate(x0 - 10, (y0 + y1) / 2 + 6); x.rotate(-Math.PI / 2); x.fillText(ay, 0, 0); x.restore();
    });
    const cl4 = (f) => Math.max(0.07, Math.min(0.93, f));   // keep every scenario inside its box
    const Lp = (p) => [LB[0] + (LB[2] - LB[0]) * cl4(0.5 + 0.3 * p.a + 0.012 * Math.sin(t4 / 70 + p.ph)), LB[1] + (LB[3] - LB[1]) * cl4(0.5 - 0.3 * p.b + 0.012 * Math.cos(t4 / 60 + p.ph))];
    const Rp = (p) => [RB[0] + (RB[2] - RB[0]) * cl4(0.5 + 0.42 * p.d1), RB[1] + (RB[3] - RB[1]) * cl4(0.5 - 0.40 * p.d2)];
    // arrow between spaces
    const ay = (T + B) / 2, ax0 = LB[2] + 8, ax1 = RB[0] - 24;   // stop short of the right chart's axis name
    x.strokeStyle = rgba(P.ink2, 0.7); x.lineWidth = 1.6;
    x.beginPath(); x.moveTo(ax0, ay - 10); x.lineTo(ax1, ay - 10); x.stroke();
    x.beginPath(); x.moveTo(ax1 - 6, ay - 15); x.lineTo(ax1, ay - 10); x.lineTo(ax1 - 6, ay - 5); x.stroke();
    x.strokeStyle = rgba(P.accent2, 0.85);
    x.beginPath(); x.moveTo(ax1, ay + 10); x.lineTo(ax0, ay + 10); x.stroke();
    x.beginPath(); x.moveTo(ax0 + 6, ay + 5); x.lineTo(ax0, ay + 10); x.lineTo(ax0 + 6, ay + 15); x.stroke();
    // points and the forward map
    sc4.forEach((p, i) => {
      const [lx, ly] = Lp(p), [rx, ry] = Rp(p), col = CL[p.k];
      const lead = Math.max(0, Math.min(1, mapT * 1.25 - (i / N4) * 0.25));
      if (ph === 0 && lead > 0 && lead < 1) {
        x.strokeStyle = rgba(P.accent, 0.18); x.lineWidth = 1;
        x.beginPath(); x.moveTo(lx, ly); x.quadraticCurveTo((lx + rx) / 2, Math.max(T + 4, Math.min(ly, ry) - 40), rx, ry); x.stroke();
        const q = (p0, p1, p2, t) => (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
        const tx = q(lx, (lx + rx) / 2, rx, lead), ty = q(ly, Math.max(T + 4, Math.min(ly, ry) - 40), ry, lead);
        x.fillStyle = P.accent; x.beginPath(); x.arc(tx, ty, 2.6, 0, 7); x.fill();
      }
      // left point: neutral, then colored by its decision cluster once mapped back
      x.fillStyle = backT > 0 ? rgba(col, 0.25 + 0.6 * backT) : rgba(P.ink3, 0.75);
      x.beginPath(); x.arc(lx, ly, 3.6, 0, 7); x.fill();
      // right point: appears as it arrives, colored by cluster once clustered
      if (lead >= 1 || ph > 0) {
        x.fillStyle = clT > 0 ? rgba(col, 0.3 + 0.6 * clT) : rgba(P.accent, 0.75);
        x.beginPath(); x.arc(rx, ry, 3.6, 0, 7); x.fill();
      }
    });
    // clusters and their representatives
    if (clT > 0) reps.forEach((r, k) => {
      const [rx, ry] = Rp(r);
      x.strokeStyle = rgba(CL[k], 0.35 * clT); x.lineWidth = 1;
      sc4.forEach((p) => { if (p.k !== k) return; const [px, py] = Rp(p); x.beginPath(); x.moveTo(rx, ry); x.lineTo(px, py); x.stroke(); });
      x.fillStyle = rgba(CL[k], 0.2 * clT); x.beginPath(); x.arc(rx, ry, 13, 0, 7); x.fill();
      x.fillStyle = CL[k]; x.strokeStyle = P.card; x.lineWidth = 2; x.beginPath(); x.arc(rx, ry, 6.5, 0, 7); x.fill(); x.stroke();
    });
    // the backward map: representatives return to the uncertainty space
    if (backT > 0) reps.forEach((r, k) => {
      const [lx, ly] = Lp(r), [rx, ry] = Rp(r);
      x.strokeStyle = rgba(CL[k], 0.75); x.lineWidth = 1.8; x.setLineDash([5, 4]);
      const cyq = Math.min(B - 4, (ly + ry) / 2 + 34);
      x.beginPath(); x.moveTo(rx, ry); x.quadraticCurveTo((lx + rx) / 2, cyq, rx + (lx - rx) * backT, ry + (ly - ry) * backT); x.stroke(); x.setLineDash([]);
      if (backT > 0.95) {
        x.fillStyle = rgba(CL[k], 0.22); x.beginPath(); x.arc(lx, ly, 13, 0, 7); x.fill();
        x.fillStyle = CL[k]; x.strokeStyle = P.card; x.lineWidth = 2; x.beginPath(); x.arc(lx, ly, 6.5, 0, 7); x.fill(); x.stroke();
      }
    });
  }
  function overlay4() {
    const [x, w, h] = fit(cvs[3]), P = pal(), cyc = t4 % 720;
    const msg = cyc < 200 ? "① map each scenario to its optimal decision"
              : cyc < 400 ? "② cluster by decision impact, pick representatives"
              : "③ map representatives back: a few scenarios that matter";
    chip(x, msg, 16, 34, P.accent2, rgba(P.accent2, 0.12));
  }

  /* ---------- 1a: offline reference learning (left of panel 1) ---------- */
  // Hindsight-optimal SOC trajectories of past years (daily means) are drawn in, weighted by how similar each
  // year is to today (kernel regression), and averaged into the SOC reference that panel 1 tracks online.
  const ND = 365, RD = new Float32Array(ND), YRS = ["2019", "2020", "2021", "2022", "2023", "2024"];
  const KW = [0.08, 0.27, 0.05, 0.33, 0.10, 0.17], PY = YRS.map(() => new Float32Array(ND));
  {
    for (let d = 0; d < ND; d++) { let m = 0; for (let k = d * 24; k < d * 24 + 24; k++) m += R1[k]; RD[d] = m / 24; }
    let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pert = YRS.map((_, s) => {
      const a = 0.05 + 0.07 * rnd(), ph = 6.28 * rnd(), b = 0.025 + 0.03 * rnd(), ps = 6.28 * rnd(), p = new Float32Array(ND);
      let z = 0;
      for (let d = 0; d < ND; d++) { z = 0.93 * z + (rnd() - 0.5) * 0.03; p[d] = a * Math.sin(2 * Math.PI * d / ND + ph) + b * Math.sin(2 * Math.PI * d * 9 / ND + ps) + z; }
      return p;
    });
    for (let d = 0; d < ND; d++) {   // remove the weighted mean so the weighted average of past years is the reference
      const m = pert.reduce((acc, p, s) => acc + KW[s] * p[d], 0);
      YRS.forEach((_, s) => { PY[s][d] = Math.max(0.03, Math.min(0.97, RD[d] + pert[s][d] - m)); });
    }
  }
  let t1a = 0;
  const C1A = 760, KWMAX = Math.max(...KW);
  function draw1a() {
    const [x, w, h] = fit(cvs[5]), P = pal();
    x.clearRect(0, 0, w, h); grid(x, w, h, P);
    t1a += 1;
    const c = reduce ? 700 : t1a % C1A;
    const L = PL, R = w - 92, T = PT, B = h - 52;
    const X = (d) => L + (R - L) * d / (ND - 1), Y = (s) => B - (B - T) * s;
    axes(x, P, L, T - 6, R, B, "day of year", "state of charge");
    x.font = "600 10.5px Inter, sans-serif"; x.lineWidth = 1;
    MDAY.forEach((d, i) => {
      x.strokeStyle = rgba(P.ink3, 0.22); x.beginPath(); x.moveTo(X(d), T); x.lineTo(X(d), B); x.stroke();
      if (i % 2 === 0) { x.fillStyle = P.ink3; x.fillText(MONTHS[i], X(d) + 3, T + 12); }
    });
    const wk = c < 260 ? 0 : ease((c - 260) / 120);        // how far the kernel weights have been applied
    // past years, drawn in one after another
    YRS.forEach((yr, s) => {
      const k = reduce ? 1 : Math.max(0, Math.min(1, (c - s * 40) / 70));
      if (k <= 0) return;
      const rel = KW[s] / KWMAX, al = (1 - wk) * 0.55 + wk * (0.12 + 0.75 * rel), lw = (1 - wk) * 1.3 + wk * (0.8 + 2.4 * rel);
      x.strokeStyle = rgba(P.ink2, al); x.lineWidth = lw; x.beginPath();
      const n = Math.floor((ND - 1) * k);
      for (let d = 0; d <= n; d += 2) { const px = X(d), py = Y(PY[s][d]); d ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.stroke();
    });
    // kernel weights per year (similarity of that year's features to today)
    const cx = R + 14, bmax = w - cx - 46;
    label(x, "weight", cx, T - 4, P.ink3, 10.5, 700);
    YRS.forEach((yr, s) => {
      const yy = T + 14 + s * 19, shown = reduce || c >= s * 40;
      label(x, yr, cx, yy + 8, shown ? P.ink2 : rgba(P.ink3, 0.4), 11, 600);
      x.fillStyle = rgba(P.ink3, 0.15); x.fillRect(cx + 34, yy, bmax, 9);
      x.fillStyle = rgba(P.accent2, 0.85); x.fillRect(cx + 34, yy, bmax * (KW[s] / KWMAX) * wk, 9);
    });
    // weighted average: the learned SOC reference and its tracking band
    const rk = reduce ? 1 : Math.max(0, Math.min(1, (c - 420) / 130));
    if (rk > 0) {
      const n = Math.floor((ND - 1) * rk);
      x.fillStyle = rgba(P.accent2, 0.13); x.beginPath();
      for (let d = 0; d <= n; d++) x.lineTo(X(d), Y(RD[d] + 0.07));
      for (let d = n; d >= 0; d--) x.lineTo(X(d), Y(RD[d] - 0.07)); x.fill();
      x.setLineDash([6, 6]); x.strokeStyle = P.accent2;
      halo(x, P.accent2, 8, 2.4, () => { x.beginPath(); for (let d = 0; d <= n; d++) d ? x.lineTo(X(d), Y(RD[d])) : x.moveTo(X(d), Y(RD[d])); });
      x.setLineDash([]);
    }
    // hand-off to the online panel
    if (c >= 560 || reduce) {
      const pulse = 0.5 + 0.5 * Math.sin(t1a / 9), ay = T + 14 + 6 * 19 + 26;
      x.strokeStyle = rgba(P.accent2, 0.5 + 0.5 * pulse); x.lineWidth = 2.4; x.lineCap = "round";
      x.beginPath(); x.moveTo(cx, ay); x.lineTo(w - 14, ay); x.moveTo(w - 21, ay - 6); x.lineTo(w - 14, ay); x.lineTo(w - 21, ay + 6); x.stroke();
      label(x, "to online", cx, ay + 18, P.accent2, 11, 700);
    }
    let lx = L;
    [["past years, hindsight-optimal", P.ink2, true], ["learned SOC reference", P.accent2, rk > 0]].forEach(([txt, col, on]) => {
      if (!on) return; tag(x, txt, lx, B + 38, col, 13.5); lx += x.measureText(txt).width + 16;
    });
  }
  function overlay1a() {
    const [x] = fit(cvs[5]), P = pal(), c = reduce ? 700 : t1a % C1A;
    const msg = c < 260 ? "① past years: hindsight-optimal SOC"
              : c < 420 ? "② weight each year by similarity to today"
              : c < 560 ? "③ weighted average → SOC reference" : "④ reference handed to online control";
    chip(x, msg, 16, 34, P.accent2, rgba(P.accent2, 0.12));
  }

  /* ---------- 2a: three ways to handle P(u), by how much is known about it (left of panel 2) ---------- */
  // The same decision u as panel 2 sets the spread of P(u). With only moments, a robust approximation for
  // unimodal distributions needs margin z = sqrt(4/(9ε) − 1) ≈ 2.81σ; with samples, a data-driven
  // (Wasserstein) reformulation needs less; with the distribution known, the iterative algorithm uses the exact
  // quantile 1.645σ. Less information, more conservative.
  const EPS = 0.05, MODES = [
    { name: "robust", info: "moments only", z: Math.sqrt(4 / (9 * EPS) - 1) },
    { name: "data-driven", info: "samples", z: 2.12 },   // illustrative: the margin depends on the radius r(u) and K
    { name: "iterative", info: "known distribution", z: 1.645 },
  ];
  const samp2 = Array.from({ length: 46 }, () => gauss());
  let t2a = 0;
  function draw2a() {
    const [x, w, h] = fit(cvs[6]), P = pal();
    x.clearRect(0, 0, w, h); grid(x, w, h, P);
    t2a += 1;
    const CM = 260, m = reduce ? 2 : Math.floor(t2a / CM) % 3, c = reduce ? CM - 1 : t2a % CM;
    const MC = [WARM, P.accent, P.accent2];
    const L = PL, R = w - 22, T = PT, Bp = T + (h - T) * 0.42, sg = 0.3 + 0.7 * uNow;
    const mx = L + (R - L) * 0.16, k = (R - 12 - mx) / (MODES[0].z * 1.0);
    const Xz = (z) => mx + k * sg * z, peak = (Bp - T - 10);
    const dens = (z) => Math.exp(-0.5 * z * z);
    // axis
    axes(x, P, L, T - 6, R, Bp, "uncertainty ξ ∼ P(u)", "density");
    x.save(); x.beginPath(); x.rect(L + 1, T - 6, R - L - 1, Bp + 10 - T); x.clip();   // curves stay inside the axes
    // what each mode knows about P(u)
    const fade = Math.min(1, c / 40);
    if (m === 0) {        // mean and spread only
      x.setLineDash([4, 4]); x.strokeStyle = rgba(P.ink3, 0.55); x.lineWidth = 1.4; x.beginPath();
      for (let i = -60; i <= 60; i++) { const z = i / 15; x.lineTo(Xz(z), Bp - peak * dens(z)); } x.stroke(); x.setLineDash([]);
      label(x, "shape unknown", Xz(0.5), T + 6, P.ink3, 11, 600);
      x.strokeStyle = rgba(WARM, fade); x.lineWidth = 2;
      x.beginPath(); x.moveTo(Xz(-1), Bp - peak * 0.6); x.lineTo(Xz(1), Bp - peak * 0.6); x.stroke();
      [-1, 1].forEach((z) => { x.beginPath(); x.moveTo(Xz(z), Bp - peak * 0.6 - 6); x.lineTo(Xz(z), Bp - peak * 0.6 + 6); x.stroke(); });
      label(x, "μ ± σ", Xz(-0.3), Bp - peak * 0.6 - 9, rgba(WARM, fade), 11.5, 700);
    } else if (m === 1) { // samples arrive one by one
      const nS = Math.min(samp2.length, Math.floor(c / 4));
      const bins = new Array(16).fill(0);
      for (let i = 0; i < nS; i++) { const z = samp2[i], bi = Math.floor((z + 3) / 6 * 16); if (bi >= 0 && bi < 16) bins[bi]++; }
      bins.forEach((n, bi) => {
        const z0 = -3 + bi * 6 / 16, bw = Xz(z0 + 6 / 16) - Xz(z0), hh = peak * n / 11;
        x.fillStyle = rgba(P.accent, 0.22); x.fillRect(Xz(z0) + 1, Bp - hh, bw - 2, hh);
      });
      for (let i = 0; i < nS; i++) { x.fillStyle = rgba(P.accent, 0.85); x.beginPath(); x.arc(Xz(samp2[i]), Bp + 6, 2.3, 0, 7); x.fill(); }
      label(x, nS + " samples", Xz(0.6), T + 6, P.accent, 11, 700);
    } else {              // the distribution itself
      x.fillStyle = rgba(P.accent2, 0.18 * fade); x.strokeStyle = rgba(P.accent2, fade); x.lineWidth = 1.8; x.beginPath();
      x.moveTo(Xz(-4), Bp); for (let i = -60; i <= 60; i++) { const z = i / 15; x.lineTo(Xz(z), Bp - peak * dens(z)); } x.lineTo(Xz(4), Bp); x.fill(); x.stroke();
      x.fillStyle = rgba(WARM, 0.55 * fade); x.beginPath(); x.moveTo(Xz(1.645), Bp);
      for (let z = 1.645; z <= 4; z += 0.05) x.lineTo(Xz(z), Bp - peak * dens(z)); x.lineTo(Xz(4), Bp); x.fill();
      label(x, "tail = ε", Xz(1.9), Bp - peak * 0.22, WARM, 11, 700);
    }
    // the 1 − ε quantile each mode certifies
    MODES.forEach((md, i) => {
      const px = Xz(md.z), on = i === m;
      x.setLineDash(on ? [] : [3, 4]); x.strokeStyle = rgba(MC[i], on ? 1 : 0.4); x.lineWidth = on ? 2.4 : 1.2;
      x.beginPath(); x.moveTo(px, T + 12); x.lineTo(px, Bp); x.stroke(); x.setLineDash([]);
    });
    x.restore();
    x.fillStyle = P.ink; x.beginPath(); x.arc(mx, Bp, 3.5, 0, 7); x.fill();
    label(x, "μ(u)", mx - 12, Bp + 18, P.ink2, 11.5, 600);
    // margin needed by each mode
    const r0 = Bp + 30, rh = (h - 28 - r0) / 3, xb0 = L + 158, xb1 = R - 46, bl = (z) => (xb1 - xb0) * z / MODES[0].z;
    MODES.forEach((md, i) => {
      const yy = r0 + i * rh, on = i === m, col = MC[i];
      label(x, md.name, 16, yy + 11, on ? col : P.ink3, 12, 700);
      x.font = "700 12px Inter, sans-serif"; const nw = x.measureText(md.name).width;
      label(x, "· " + md.info, 16 + nw + 6, yy + 11, on ? P.ink2 : rgba(P.ink3, 0.7), 11, 500);
      x.fillStyle = rgba(P.ink3, 0.12); x.fillRect(xb0, yy + 1, bl(MODES[0].z), 12);
      x.fillStyle = rgba(col, on ? 0.9 : 0.35); x.fillRect(xb0, yy + 1, bl(md.z), 12);
      label(x, i === 1 ? "r(u), K" : md.z.toFixed(2) + "σ", xb0 + bl(md.z) + 6, yy + 11, on ? col : P.ink3, 11, 700);
    });
    tag(x, "more information → smaller margin, lower cost", 16, h - 10, P.ink2, 13);
  }
  function overlay2a() {
    const [x] = fit(cvs[6]), P = pal(), m = reduce ? 2 : Math.floor(t2a / 260) % 3;
    const msg = ["① moments only → robust approximation", "② samples → data-driven reformulation", "③ known distribution → iterative algorithm"][m];
    const col = [WARM, P.accent, P.accent2][m];
    chip(x, msg, 16, 34, col, rgba(col, 0.12));
  }

  /* ---------- 3a: stepwise bids over SOC segments, monotone in SOC and in risk aversion (left of panel 3) ---------- */
  // The marginal value of stored energy falls with SOC and rises with price uncertainty σ (risk aversion), so the
  // segment-wise discharge offers and charge bids do too; the opportunity cost bound b̄ follows the same shape.
  const NSEG = 10, ETA = 0.92;
  const mval = (e, s) => 16 + 52 * Math.pow(1 - e, 1.35) + s * (8 + 34 * (1 - e));
  let t3a = 0;
  const MDEG = 6;   // marginal degradation cost M [$/MWh]
  function draw3a() {
    const [x, w, h] = fit(cvs[7]), P = pal();
    x.clearRect(0, 0, w, h); grid(x, w, h, P);
    t3a += 1;
    const sgm = reduce ? 0.7 : 0.5 + 0.5 * Math.sin(t3a / 130), soc = 0.5 + 0.42 * Math.sin(t3a / 210 + 1);
    const L = PL, R = w - 16, T = PT, B = h - 62, PM = 130;
    const X = (e) => L + (R - L) * e, Y = (p) => B - (B - T) * p / PM;
    axes(x, P, L, T - 6, R, B, "state of charge e", "bid ($/MWh)");
    [0, 50, 100].forEach((p) => label(x, String(p), L - 22, Y(p) + 4, P.ink3, 10.5));
    label(x, "0%", L - 4, B + 15, P.ink3, 10.5); label(x, "100%", R - 28, B + 15, P.ink3, 10.5);
    // active SOC segment
    const si = Math.min(NSEG - 1, Math.floor(soc * NSEG));
    x.fillStyle = rgba(P.accent, 0.07); x.fillRect(X(si / NSEG), T - 6, (R - L) / NSEG, B - T + 6);
    const steps = (f, s) => { x.beginPath(); for (let i = 0; i < NSEG; i++) { const y = Y(f(mval((i + 0.5) / NSEG, s))); i ? x.lineTo(X(i / NSEG), y) : x.moveTo(X(0), y); x.lineTo(X((i + 1) / NSEG), y); } };
    const dis = (v) => MDEG + v / ETA, chg = (v) => ETA * v;    // discharge bid A = M + v/η, charge bid D = η v
    // ghost steps at the lowest and highest price uncertainty
    [0, 1].forEach((s) => { x.strokeStyle = rgba(P.ink3, 0.35); x.lineWidth = 1; x.setLineDash([2, 3]); steps(dis, s); x.stroke(); x.setLineDash([]); });
    halo(x, P.accent, 7, 2.4, () => steps(dis, sgm));
    halo(x, P.accent2, 7, 2.4, () => steps(chg, sgm));
    // markers on the active segment
    const ex = X((si + 0.5) / NSEG), vd = mval((si + 0.5) / NSEG, sgm);
    x.fillStyle = P.accent; tri(x, ex, Y(dis(vd)) - 1, 1, 5.5); x.fill();
    x.fillStyle = P.accent2; tri(x, ex, Y(chg(vd)) + 1, -1, 5.5); x.fill();
    // battery icon riding on the SOC axis
    const bx = X(soc) - 9, by = B + 29;
    x.strokeStyle = P.ink2; x.lineWidth = 1.4; x.strokeRect(bx, by, 18, 9); x.fillStyle = P.ink2; x.fillRect(bx + 18, by + 3, 2, 3);
    x.fillStyle = rgba(P.accent, 0.85); x.fillRect(bx + 1.5, by + 1.5, 15 * soc, 6);
    // labels in clear space: above the highest discharge steps, below the lowest charge steps
    tag(x, "discharge bid A", X(0.03), Y(dis(mval(0.05, 1))) - 8, P.accent, 12.5);
    tag(x, "charge bid D", X(0.03), Y(chg(mval(0.05, 0))) + 22, P.accent2, 12.5);
    // price-uncertainty slider
    const sy = h - 14, sx0 = L + 100, sx1 = R;
    x.strokeStyle = rgba(P.ink3, 0.5); x.lineWidth = 3; x.lineCap = "round";
    x.beginPath(); x.moveTo(sx0, sy); x.lineTo(sx1, sy); x.stroke();
    x.strokeStyle = WARM; x.beginPath(); x.moveTo(sx0, sy); x.lineTo(sx0 + (sx1 - sx0) * sgm, sy); x.stroke();
    x.fillStyle = P.card; x.strokeStyle = WARM; x.lineWidth = 2.2;
    x.beginPath(); x.arc(sx0 + (sx1 - sx0) * sgm, sy, 6.5, 0, 7); x.fill(); x.stroke();
    tag(x, "price uncertainty σ", 12, sy + 4, WARM, 13);
  }
  function overlay3a() {
    const [x] = fit(cvs[7]), P = pal();
    chip(x, "SOC ↑ → bids ↓ · σ ↑ → bids ↑", 16, 34, P.accent, rgba(P.accent, 0.12));
  }

  /* ---------- 3b: cone-constrained PCA of the storage value function (middle of panel 3) ---------- */
  // Each time step's value function q_t over N SOC segments is an N-dimensional vector. With the mean q̄ and the
  // leading cone-constrained principal direction ν* (monotone non-increasing), every step is rebuilt as
  // q̂_t = q̄ + ŵ_t ν* from one nonnegative score ŵ_t = max(0, ⟨q_t − q̄, ν*⟩): rank 1, one number sets the curve.
  const NE = 40, NHR = 16;
  const qbar = (e) => 0.10 + 0.30 * Math.pow(1 - e, 1.5), nu = (e) => 0.55 * Math.pow(1 - e, 1.8);
  const hrs = Array.from({ length: NHR }, (_, i) => ({ w: 0.05 + 0.92 * (0.5 + 0.5 * Math.sin(i * 2.4 + 0.7)), dv: (Math.random() - 0.5) * 0.13, f: 1 + (i % 3) }));   // residual off the rank-1 line, visible in the PCA view
  let t3b = 0;
  function draw3b() {
    const [x, w, h] = fit(cvs[8]), P = pal();
    x.clearRect(0, 0, w, h); grid(x, w, h, P);
    t3b += 1;
    const C = 260 + 4 * 115, c = reduce ? C - 1 : t3b % C;
    const k1 = reduce ? 1 : Math.min(1, c / 130);                          // Q fills column by column
    const k2 = reduce ? 1 : Math.max(0, Math.min(1, (c - 140) / 110));   // q̄, ν* and the scores ŵᵀ
    const st = c < 260 ? -1 : [2, 7, 11, 14][Math.min(3, Math.floor((c - 260) / 115))];   // the step whose bid is shown
    const q = (e, hr) => qbar(e) + hr.w * nu(e) + hr.dv * Math.sin(Math.PI * e * hr.f) * (1 - e);
    // top: Q (N × T) ≈ q̄ 1ᵀ + ν* ŵᵀ
    const NR = 10, my = 52, mh = 64, W = w - 32;
    const qw = W * 0.36, cw = 9, rw = W * 0.30, sym = 18;
    let cx = 16;
    const cap = (t, x0, wd, on) => { x.font = "700 11px Inter, sans-serif"; const tw = x.measureText(t).width; x.fillStyle = on ? P.ink2 : rgba(P.ink3, 0.45); x.fillText(t, x0 + (wd - tw) / 2, my + mh + 14); };
    const op = (t, on) => { x.font = "700 15px Inter, sans-serif"; x.fillStyle = on ? P.ink : rgba(P.ink3, 0.35); x.fillText(t, cx + 3, my + mh / 2 + 5); cx += sym; };
    const nCol = Math.ceil(NHR * k1);
    for (let i = 0; i < NHR; i++) for (let r = 0; r < NR; r++) {
      const v = i < nCol ? q(r / (NR - 1), hrs[i]) : 0;
      x.fillStyle = i < nCol ? rgba(P.accent, 0.12 + 0.85 * Math.min(1, v / 0.95)) : rgba(P.ink3, 0.08);
      x.fillRect(cx + i * qw / NHR, my + r * mh / NR, qw / NHR - 0.8, mh / NR - 0.8);
    }
    const qx = cx;
    if (st >= 0) { x.strokeStyle = WARM; x.lineWidth = 2; x.strokeRect(qx + st * qw / NHR - 1, my - 1, qw / NHR + 1, mh + 1); }
    cap("Q  (N × T)", cx, qw, true); cx += qw + 2;
    op("≈", k2 > 0.3);
    for (let r = 0; r < NR; r++) { x.fillStyle = rgba(P.ink2, k2 * (0.15 + 0.8 * qbar(r / (NR - 1)) / 0.4)); x.fillRect(cx, my + r * mh / NR, cw, mh / NR - 0.8); }
    cap("q̄", cx - 6, cw + 12, k2 > 0.3); cx += cw;
    op("+", k2 > 0.3);
    const bx0 = cx;
    for (let r = 0; r < NR; r++) { x.fillStyle = rgba(WARM, k2 * (0.12 + 0.85 * nu(r / (NR - 1)) / 0.55)); x.fillRect(cx, my + r * mh / NR, cw, mh / NR - 0.8); }
    cap("ν*", cx - 6, cw + 12, k2 > 0.3); cx += cw + 6;
    const wy = my + mh / 2 - 6, wx = cx;
    for (let i = 0; i < NHR; i++) {
      const on = k2 * 1.6 - i / NHR * 0.6 > 0;
      x.fillStyle = on ? rgba(P.accent2, 0.15 + 0.8 * hrs[i].w) : rgba(P.ink3, 0.08);
      x.fillRect(cx + i * rw / NHR, wy, rw / NHR - 0.8, 12);
    }
    if (st >= 0) { x.strokeStyle = WARM; x.lineWidth = 2; x.strokeRect(wx + st * rw / NHR - 1, wy - 1, rw / NHR + 1, 14); }
    cap("ŵᵀ", cx, rw, k2 > 0.3);
    // bracket: the rank-1 term ν* ŵᵀ
    const bx1 = cx + rw, by = my - 4;
    x.strokeStyle = k2 > 0.5 ? WARM : rgba(P.ink3, 0.35); x.lineWidth = 1.4;
    x.beginPath(); x.moveTo(bx0, by + 4); x.lineTo(bx0, by); x.lineTo(bx1, by); x.lineTo(bx1, by + 4); x.stroke();
    x.font = "700 11px Inter, sans-serif"; const rk = "rank 1", rkw = x.measureText(rk).width;
    x.fillStyle = P.card; x.fillRect((bx0 + bx1 - rkw) / 2 - 3, by - 11, rkw + 6, 12);
    x.fillStyle = k2 > 0.5 ? WARM : rgba(P.ink3, 0.45); x.fillText(rk, (bx0 + bx1 - rkw) / 2, by - 1);
    // bottom: the bid curve of the highlighted step, from q̂_t = q̄ + ŵ_t ν*
    const L = PL, R = w - 16, T2 = my + mh + 34, B = h - 62, PM = 150;
    const X = (e) => L + (R - L) * e, Y = (p) => B - (B - T2) * Math.min(PM, p) / PM;
    axes(x, P, L, T2 - 4, R, B, "state of charge e", "bid ($/MWh)");
    if (st >= 0) {
      const hr = hrs[st], qh = (e) => (qbar(e) + hr.w * nu(e)) * 130;
      const dis = (e) => MDEG + qh(e) / ETA, chg = (e) => ETA * qh(e);
      const steps = (f) => { x.beginPath(); for (let i = 0; i < NSEG; i++) { const y = Y(f((i + 0.5) / NSEG)); i ? x.lineTo(X(i / NSEG), y) : x.moveTo(X(0), y); x.lineTo(X((i + 1) / NSEG), y); } };
      const g = ease(((c - 260) % 115) / 30);
      x.globalAlpha = g; halo(x, P.accent, 6, 2.2, () => steps(dis)); halo(x, P.accent2, 6, 2.2, () => steps(chg)); x.globalAlpha = 1;
      // link from the score cell to the curve
      x.setLineDash([3, 3]); x.strokeStyle = rgba(WARM, 0.8); x.lineWidth = 1.2;
      const lkx = wx + (st + 0.5) * rw / NHR;
      x.beginPath(); x.moveTo(lkx, wy + 14); x.lineTo(lkx, T2 - 6); x.stroke(); x.setLineDash([]);
      x.font = "italic 12.5px Fraunces, Georgia, serif"; const t1 = "discharge A", t2 = "charge D";
      tag(x, t1, R - x.measureText(t1).width - 2, Y(dis(0.85)) - 6, P.accent, 12.5);
      tag(x, t2, L + 6, Math.min(B - 6, Y(chg(0.05)) + 26), P.accent2, 12.5);
    }
  }
  function overlay3b() {
    const [x] = fit(cvs[8]), P = pal(), C = 260 + 4 * 115, c = reduce ? C - 1 : t3b % C;
    const msg = c < 140 ? "① value functions Q" : c < 260 ? "② rank-1 PCA" : "③ one number ŵ_t → bid curve";
    const col = c < 140 ? P.accent : c < 260 ? WARM : P.accent2;
    chip(x, msg, 16, 30, col, rgba(col, 0.12));
  }

  /* ---------- 4b: risk-averse (CVaR) iterative problem-driven scenario reduction (right of panel 4) ---------- */
  // The same scenarios and the same two spaces as panel 4. The worst 10% of scenarios by cost (the CVaR tail, warm)
  // sit in the decision space but get merged into ordinary clusters by the risk-neutral reduction, so the reduced
  // set underestimates CVaR. Each iteration adds a representative inside the tail and maps it back; the CVaR of the
  // representatives (weights = cluster masses) closes in on the CVaR of all scenarios.
  const ALPHA = 0.9;
  sc4.forEach((p) => { p.f = Math.exp(1.2 * (p.d1 + p.d2)); });   // cost grows toward the upper right of the decision space
  const VAR4 = sc4.map((p) => p.f).sort((p, q) => p - q)[Math.floor(ALPHA * N4)];
  sc4.forEach((p) => { p.tail = p.f >= VAR4; });
  const tl4 = sc4.filter((p) => p.tail).sort((p, q) => q.f - p.f);
  const tailMed = (() => {    // the tail scenario closest to the tail's centre
    const m1 = tl4.reduce((a, p) => a + p.d1, 0) / tl4.length, m2 = tl4.reduce((a, p) => a + p.d2, 0) / tl4.length;
    return tl4.reduce((b, p) => ((p.d1 - m1) ** 2 + (p.d2 - m2) ** 2 < (b.d1 - m1) ** 2 + (b.d2 - m2) ** 2 ? p : b), tl4[0]);
  })();
  const ADD4 = [tl4[0], tailMed === tl4[0] ? tl4[Math.min(2, tl4.length - 1)] : tailMed];
  const SETS4 = [reps.slice(), reps.concat([ADD4[0]]), reps.concat(ADD4)];
  const CVS4 = [0.6, 0.85, 0.98];   // illustrative share of CVaR(N) captured by the representatives after each iteration
  const STEP4B = 170, C4B = 3 * STEP4B + 70, TAIL = "#d64532";   // tail in red, distinct from cluster colors
  let t4b = 0;
  function draw4b() {
    const [x, w, h] = fit(cvs[9]), P = pal();
    x.clearRect(0, 0, w, h); grid(x, w, h, P);
    t4b += 1;
    const c = reduce ? C4B - 1 : t4b % C4B, it = Math.min(2, Math.floor(c / STEP4B));
    const kk = it === 0 ? 1 : c >= 3 * STEP4B ? 1 : ease((c % STEP4B) / 80);   // the new representative maps back
    const lit = it === 0 ? ease((c - 60) / 50) : 1;                              // tail lights up after the start
    const T = PT, B = h - 78, gap = 70, half = (w - PL - 16 - gap) / 2;
    const LB = [PL, T, PL + half, B], RB = [PL + half + gap, T, w - 16, B];
    [[LB, "uncertainty space  ξ"], [RB, "decision space  x*(ξ)"]].forEach(([[x0, y0, x1, y1], ttl]) => {
      x.fillStyle = rgba(P.card, 0.65); x.strokeStyle = rgba(P.ink3, 0.45); x.lineWidth = 1;
      x.beginPath(); x.roundRect ? x.roundRect(x0, y0, x1 - x0, y1 - y0, 10) : x.rect(x0, y0, x1 - x0, y1 - y0); x.fill(); x.stroke();
      tag(x, ttl, x0 + 4, y1 + 38, P.ink2, 13.5);
    });
    [[LB, "ξ₁", "ξ₂"], [RB, "z₁*", "z₂*"]].forEach(([[x0, y0, x1, y1], ax, ay]) => {
      x.font = "600 11px Inter, sans-serif"; x.fillStyle = P.ink2;
      const tw = x.measureText(ax).width; x.fillText(ax, (x0 + x1 - tw) / 2, y1 + 15);
      x.save(); x.translate(x0 - 10, (y0 + y1) / 2 + 6); x.rotate(-Math.PI / 2); x.fillText(ay, 0, 0); x.restore();
    });
    const cl = (f) => Math.max(0.07, Math.min(0.93, f));
    const Lp = (p) => [LB[0] + (LB[2] - LB[0]) * cl(0.5 + 0.3 * p.a), LB[1] + (LB[3] - LB[1]) * cl(0.5 - 0.3 * p.b)];
    const Rp = (p) => [RB[0] + (RB[2] - RB[0]) * cl(0.5 + 0.42 * p.d1), RB[1] + (RB[3] - RB[1]) * cl(0.5 - 0.40 * p.d2)];
    const set = SETS4[it], nOld = SETS4[Math.max(0, it - 1)].length;
    // assignment of every scenario to its nearest representative in the decision space
    const own = (p, S) => { let k = 0; S.forEach((r, j) => { if ((p.d1 - r.d1) ** 2 + (p.d2 - r.d2) ** 2 < (p.d1 - S[k].d1) ** 2 + (p.d2 - S[k].d2) ** 2) k = j; }); return k; };
    const colOf = (k) => (k < K4 ? P.accent : TAIL);   // risk-neutral representatives blue, tail representatives red
    // decision space: links to representatives, scenarios, tail halo
    sc4.forEach((p) => {
      const k = own(p, kk >= 1 ? set : SETS4[Math.max(0, it - 1)]), r = (kk >= 1 ? set : SETS4[Math.max(0, it - 1)])[k];
      const [px, py] = Rp(p), [rx, ry] = Rp(r);
      x.strokeStyle = rgba(colOf(k), 0.22); x.lineWidth = 1; x.beginPath(); x.moveTo(rx, ry); x.lineTo(px, py); x.stroke();
    });
    sc4.forEach((p) => {
      const [px, py] = Rp(p), [lx, ly] = Lp(p);
      if (p.tail && lit > 0) {
        x.fillStyle = rgba(TAIL, 0.18 * lit); x.beginPath(); x.arc(px, py, 9, 0, 7); x.fill(); x.beginPath(); x.arc(lx, ly, 9, 0, 7); x.fill();
      }
      const col = p.tail && lit > 0.5 ? TAIL : rgba(P.ink3, 0.65);
      x.fillStyle = col; x.beginPath(); x.arc(px, py, 3.4, 0, 7); x.fill();
      x.beginPath(); x.arc(lx, ly, 3.4, 0, 7); x.fill();
    });
    // representatives in both spaces; the newly added tail representative maps back along a dashed curve
    set.forEach((r, k) => {
      const [rx, ry] = Rp(r), [lx, ly] = Lp(r), isNew = k >= nOld && it > 0, col = colOf(k);
      x.fillStyle = rgba(col, 0.22); x.beginPath(); x.arc(rx, ry, 13, 0, 7); x.fill();
      x.fillStyle = col; x.strokeStyle = P.card; x.lineWidth = 2; x.beginPath(); x.arc(rx, ry, 6.5, 0, 7); x.fill(); x.stroke();
      const e = isNew ? kk : 1;
      if (isNew && e < 1) {
        x.strokeStyle = rgba(TAIL, 0.85); x.lineWidth = 1.8; x.setLineDash([5, 4]);
        x.beginPath(); x.moveTo(rx, ry); x.quadraticCurveTo((lx + rx) / 2, Math.min(B - 4, (ly + ry) / 2 + 34), rx + (lx - rx) * e, ry + (ly - ry) * e); x.stroke(); x.setLineDash([]);
      }
      if (e >= 1) {
        x.fillStyle = rgba(col, 0.22); x.beginPath(); x.arc(lx, ly, 13, 0, 7); x.fill();
        x.fillStyle = col; x.strokeStyle = P.card; x.lineWidth = 2; x.beginPath(); x.arc(lx, ly, 6.5, 0, 7); x.fill(); x.stroke();
      }
    });
    if (lit > 0.5) { x.font = "italic 13px Fraunces, Georgia, serif"; const tw = x.measureText("CVaR tail (worst 10%)").width; tag(x, "CVaR tail (worst 10%)", RB[0] + 2, RB[1] - 5, TAIL, 13); }
    // arrows between the spaces
    const ay = (T + B) / 2, ax0 = LB[2] + 8, ax1 = RB[0] - 24;
    x.strokeStyle = rgba(P.ink2, 0.7); x.lineWidth = 1.6;
    x.beginPath(); x.moveTo(ax0, ay - 10); x.lineTo(ax1, ay - 10); x.moveTo(ax1 - 6, ay - 15); x.lineTo(ax1, ay - 10); x.lineTo(ax1 - 6, ay - 5); x.stroke();
    x.strokeStyle = rgba(TAIL, 0.85);
    x.beginPath(); x.moveTo(ax1, ay + 10); x.lineTo(ax0, ay + 10); x.moveTo(ax0 + 6, ay + 5); x.lineTo(ax0, ay + 10); x.lineTo(ax0 + 6, ay + 15); x.stroke();
    // CVaR gauge: CVaR of the representatives against CVaR of all scenarios
    const frac = it === 0 ? CVS4[0] : CVS4[it - 1] + (CVS4[it] - CVS4[it - 1]) * kk;
    const gw = Math.min(150, w * 0.26), gx = w - 16 - gw, gy = 26;
    label(x, "CVaR(ζ) / CVaR(N)", gx, gy - 4, P.ink2, 10.5, 700);
    x.fillStyle = rgba(P.ink3, 0.2); x.fillRect(gx, gy + 2, gw, 9);
    x.fillStyle = frac > 0.9 ? P.accent2 : TAIL; x.fillRect(gx, gy + 2, gw * frac, 9);
    x.strokeStyle = P.ink; x.lineWidth = 1.5; x.beginPath(); x.moveTo(gx + gw, gy - 1); x.lineTo(gx + gw, gy + 14); x.stroke();
  }
  function overlay4b() {
    const [x] = fit(cvs[9]), P = pal(), c = reduce ? C4B - 1 : t4b % C4B, it = Math.min(2, Math.floor(c / STEP4B));
    const msg = it === 0 ? "① risk-neutral reduction misses the tail" : c < 3 * STEP4B ? "iteration " + it + ": add a tail representative" : "③ tail represented: CVaR(ζ) ≈ CVaR(N)";
    const col = it === 0 ? "#d64532" : P.accent2;
    chip(x, msg, 16, 34, col, rgba(col, 0.12));
  }

  /* ---------- 5: energy security and synthetic fuels ---------- */
  // Supply hubs ship fuel to an importing economy through two chokepoints. Periodically a chokepoint is
  // disrupted: its routes turn warm and stall, and domestic synthetic-fuel plants ramp up as insurance.
  let t5 = 0;
  const hubs = [[0.12, 0.30], [0.10, 0.62], [0.22, 0.82], [0.30, 0.15]];
  const choke = [[0.45, 0.40], [0.47, 0.70]];
  const home = [0.80, 0.50];
  const plants = [[0.74, 0.30], [0.88, 0.34], [0.72, 0.68], [0.90, 0.66]];
  const ships = [];
  function draw5() {
    const [x, w, h] = fit(cvs[4]), P = pal();
    x.clearRect(0, 0, w, h); grid(x, w, h, P);
    t5 += 1;
    const L = 20, R = w - 20, T = 40, B = h - 34;
    const S = ([u, v]) => [L + (R - L) * u, T + (B - T) * v];
    const cyc = t5 % 900, disrupt = cyc > 300 && cyc < 720 ? 1 : 0;
    const level = disrupt ? Math.min(1, (cyc - 300) / 160) : Math.max(0, 1 - (cyc > 720 ? (cyc - 720) / 160 : 1));
    const hit = Math.floor(t5 / 900) % 2;            // which chokepoint is disrupted this cycle
    // routes hub -> chokepoint -> home
    hubs.forEach((hb, i) => {
      const c = choke[i % 2], down = disrupt && (i % 2 === hit);
      const a = S(hb), m = S(c), z = S(home);
      x.strokeStyle = down ? rgba(WARM, 0.55) : rgba(P.accent, 0.35); x.lineWidth = down ? 1.6 : 2;
      x.setLineDash(down ? [4, 5] : []);
      x.beginPath(); x.moveTo(a[0], a[1]); x.quadraticCurveTo((a[0] + m[0]) / 2, Math.min(a[1], m[1]) - 18, m[0], m[1]);
      x.quadraticCurveTo((m[0] + z[0]) / 2, (m[1] + z[1]) / 2 + 20, z[0], z[1]); x.stroke(); x.setLineDash([]);
    });
    // ships moving along live routes
    if (!reduce && Math.random() < 0.12) { const i = Math.floor(Math.random() * hubs.length); ships.push({ i, s: 0 }); }
    for (let k = ships.length - 1; k >= 0; k--) {
      const sh = ships[k], down = disrupt && (sh.i % 2 === hit);
      const a = S(hubs[sh.i]), m = S(choke[sh.i % 2]), z = S(home);
      if (!(down && sh.s > 0.42 && sh.s < 0.5)) sh.s += 0.006;
      if (sh.s >= 1) { ships.splice(k, 1); continue; }
      const q = (p0, p1, p2, t) => (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
      let px, py;
      if (sh.s < 0.5) { const t = sh.s / 0.5; px = q(a[0], (a[0] + m[0]) / 2, m[0], t); py = q(a[1], Math.min(a[1], m[1]) - 18, m[1], t); }
      else { const t = (sh.s - 0.5) / 0.5; px = q(m[0], (m[0] + z[0]) / 2, z[0], t); py = q(m[1], (m[1] + z[1]) / 2 + 20, z[1], t); }
      x.fillStyle = down ? WARM : P.accent; x.beginPath(); x.arc(px, py, 3.2, 0, 7); x.fill();
    }
    // supply hubs
    hubs.forEach((hb) => { const [a, b] = S(hb); x.fillStyle = P.ink2; x.beginPath(); x.arc(a, b, 6, 0, 7); x.fill(); });
    // chokepoints
    choke.forEach((c, i) => {
      const [a, b] = S(c), down = disrupt && i === hit;
      if (down) { x.strokeStyle = rgba(WARM, 0.5); x.lineWidth = 2; x.beginPath(); x.arc(a, b, 12 + 6 * Math.sin(t5 / 5), 0, 7); x.stroke(); }
      x.fillStyle = down ? WARM : P.card; x.strokeStyle = down ? WARM : P.ink2; x.lineWidth = 2;
      x.beginPath(); x.moveTo(a, b - 8); x.lineTo(a + 8, b); x.lineTo(a, b + 8); x.lineTo(a - 8, b); x.closePath(); x.fill(); x.stroke();
    });
    // importing economy and domestic synthetic-fuel plants
    const [hx, hy] = S(home);
    x.fillStyle = rgba(P.accent, 0.14); x.beginPath(); x.arc(hx, hy, 44, 0, 7); x.fill();
    x.fillStyle = P.accent; x.beginPath(); x.arc(hx, hy, 10, 0, 7); x.fill();
    plants.forEach((pl) => {
      const [a, b] = S(pl), on = level;
      x.fillStyle = rgba(P.accent2, 0.15 + 0.7 * on); x.strokeStyle = P.accent2; x.lineWidth = 1.6;
      x.beginPath(); x.roundRect ? x.roundRect(a - 8, b - 8, 16, 16, 3) : x.rect(a - 8, b - 8, 16, 16); x.fill(); x.stroke();
      if (on > 0.05) { x.strokeStyle = rgba(P.accent2, 0.6 * on); x.lineWidth = 2;
        x.beginPath(); x.moveTo(a, b); x.lineTo(hx + (a - hx) * 0.25, hy + (b - hy) * 0.25); x.stroke(); }
    });
    if (disrupt) tag(x, "chokepoint disrupted", S(choke[hit])[0] - 70, S(choke[hit])[1] + (hit ? 30 : -18), WARM, 13);
    tag(x, "supply hubs", L, B + 22, P.ink2);
    tag(x, "chokepoints", L + 110, B + 22, P.ink2);
    tag(x, "domestic synthetic-fuel plants", L + 215, B + 22, P.accent2);
    label(x, "importing economy", hx - 50, hy + 62, P.ink3, 11.5, 600);
  }

  /* ---------- overlays: a plain-language caption (what you see) and the math behind it ---------- */
  function chip(x, txt, px, py, col, bg) {
    x.font = "600 12.5px Inter, sans-serif";
    const tw = x.measureText(txt).width, ph = 24;
    x.fillStyle = bg; x.beginPath();
    x.roundRect ? x.roundRect(px, py - ph + 6, tw + 20, ph, 12) : x.rect(px, py - ph + 6, tw + 20, ph); x.fill();
    x.fillStyle = col; x.fillText(txt, px + 10, py - 5);
  }
  function mathBox(x, lines, right, top, P) {
    x.font = "italic 14px Fraunces, Georgia, serif";
    const tw = Math.max(...lines.map((l) => x.measureText(l).width)), bw = tw + 22, bh = 12 + 20 * lines.length;
    const bx = right - bw;
    x.fillStyle = rgba(P.card, 0.92); x.strokeStyle = rgba(P.ink3, 0.45); x.lineWidth = 1;
    x.beginPath(); x.roundRect ? x.roundRect(bx, top, bw, bh, 8) : x.rect(bx, top, bw, bh); x.fill(); x.stroke();
    lines.forEach((l, i) => { x.fillStyle = i === 0 ? P.ink : P.ink2; x.fillText(l, bx + 11, top + 22 + 20 * i); });
  }
  function overlay1() {
    const [x, w, h] = fit(cvs[0]), P = pal(), v = view1;
    const msg = v.ph === 0 ? "① hour " + Math.floor(v.head) + " · decide now, track the reference"
              : v.ph === 1 ? "② zooming out: hours → a full year"
              : v.ph === 2 ? "③ a year online ≈ hindsight optimum" : "zooming back in";
    chip(x, msg, 16, 34, v.ph === 2 ? WARM : P.accent, rgba(v.ph === 2 ? WARM : P.accent, 0.12));
  }
  function overlay2() {
    const [x, w, h] = fit(cvs[1]), P = pal();
    const DW = Math.min(150, w * 0.2), R = w - DW - 28;
    const msg = uNow < 0.35 ? "cautious decision → narrow uncertainty, safe"
              : uNow < 0.7 ? "bolder decision → uncertainty widens"
              : "aggressive decision → wide uncertainty, bound violations";
    chip(x, msg, 16, 34, uNow < 0.7 ? P.accent2 : WARM, rgba(uNow < 0.7 ? P.accent2 : WARM, 0.12));
  }
  function overlay3() {
    const [x, w, h] = fit(cvs[2]), P = pal(), on = (reduce ? 600 : t3 % C3) >= SW3;
    chip(x, on ? "② mitigate: bounds enforced, withholding capped" : "① detect: withholding grows unchecked",
         16, 34, on ? P.accent2 : WARM, rgba(on ? P.accent2 : WARM, 0.12));
  }
  function overlay5() {
    const [x, w, h] = fit(cvs[4]), P = pal();
    const cyc = t5 % 900, disrupt = cyc > 300 && cyc < 720;
    const share = disrupt ? 0.62 - 0.32 * Math.min(1, (cyc - 300) / 160) : 0.62;
    chip(x, disrupt ? "disruption → domestic synthetic fuels ramp up" : "normal trade through chokepoints", 16, 34,
         disrupt ? WARM : P.accent, rgba(disrupt ? WARM : P.accent, 0.12));
    // import dependence gauge
    const gx = w - 200, gy = h - 50, gw = 170;
    label(x, "import dependence  " + Math.round(share * 100) + "%", gx, gy - 6, P.ink3, 11.5, 600);
    x.fillStyle = rgba(P.ink3, 0.25); x.fillRect(gx, gy, gw, 7);
    x.fillStyle = disrupt ? WARM : P.accent; x.fillRect(gx, gy, gw * share, 7);
  }

  let visible = true, raf = 0;
  const sec = document.getElementById("signature");
  if ("IntersectionObserver" in window && sec)
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible && !reduce) run(); }, { rootMargin: "120px" }).observe(sec);
  function frame() {
    step1(); draw1a(); overlay1a(); draw1(); overlay1(); draw2(); overlay2(); draw2a(); overlay2a();
    draw3a(); overlay3a(); draw3b(); overlay3b(); draw3(); overlay3(); draw4(); overlay4(); draw4b(); overlay4b(); if (cvs[4]) { draw5(); overlay5(); }
  }
  function run() { cancelAnimationFrame(raf); (function loop() { if (!visible) return; frame(); raf = requestAnimationFrame(loop); })(); }
  window.addEventListener("resize", () => frame());
  if (reduce) frame(); else run();
})();
