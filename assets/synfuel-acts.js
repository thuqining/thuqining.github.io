/* Three-act animation drawn on top of the synthetic-fuel corridor map (Signature Work page).
   Act 1  today: only fossil fuel (oil and LNG) moves, along today's lanes through the chokepoints.
   Act 2  chokepoints disrupted: Hormuz, Suez, Panama and Malacca pulse red; fossil lanes through them are cut.
   Act 3  security value exceeds the cost premium: build-first regions make synthetic fuel at home, and
          export-oriented neighbors supply it over short corridors that avoid the chokepoints.
   Positions are fractions of the map image (1800 x 719). Colors follow the site's CSS variables.
   Respects prefers-reduced-motion (shows act 3) and pauses when off screen. */
(function () {
  const cv = document.getElementById("sig5acts");
  if (!cv) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const RED = "#d64532", WARM = "#e0703a";
  // positions traced on the map image (fractions of 1800 x 719); synthetic-fuel routes follow the dashed corridors
  // in the paper's figure, existing routes are today's main oil and LNG shipping lanes
  const CHOKE = [
    { n: "Hormuz", x: 0.652, y: 0.405, side: 1 }, { n: "Suez", x: 0.590, y: 0.373, side: -1 },
    { n: "Panama", x: 0.268, y: 0.490, side: 1 }, { n: "Malacca", x: 0.782, y: 0.566, side: -1 },
  ];
  const EXPORT = [{ x: 0.658, y: 0.417 }, { x: 0.304, y: 0.654 }, { x: 0.822, y: 0.702 }, { x: 0.511, y: 0.362 },
                  { x: 0.508, y: 0.265 }, { x: 0.800, y: 0.295 }];
  // build-first regions (low cost, high demand) where synthetic fuel is made at home in act 3
  const BUILD = [{ x: 0.780, y: 0.403 }, { x: 0.725, y: 0.428 }, { x: 0.625, y: 0.440 }, { x: 0.190, y: 0.365 },
                 { x: 0.225, y: 0.265 }];
  const FOSSIL = "#3A4550";
  const Q = [0.644, 0.396], HZ = [0.652, 0.405], GO = [0.668, 0.432], BAB = [0.628, 0.494], SZ = [0.590, 0.373],
        GIB = [0.467, 0.359], BIS = [0.489, 0.278], RTM = [0.528, 0.229], SL = [0.722, 0.556], MAL = [0.782, 0.566],
        SCS = [0.817, 0.487], JP = [0.881, 0.341], SH = [0.839, 0.369], PAN = [0.268, 0.490], USG = [0.244, 0.369];
  // stop = index of the chokepoint vertex where the route is cut (-1 = stays open)
  const ROUTES = [
    // synthetic-fuel corridors (paper)
    { p: [[0.658, 0.417], BAB, SZ, [0.528, 0.364], GIB, BIS, RTM], stop: 2, w: 3, syn: true },          // Oman -> Rotterdam via Suez
    { p: [[0.658, 0.417], [0.660, 0.459], [0.653, 0.654], [0.622, 0.779], [0.583, 0.832], [0.556, 0.839], [0.517, 0.800],
          [0.475, 0.654], [0.456, 0.459], [0.469, 0.355], BIS, RTM], stop: -1, w: 1, syn: true, detour: true }, // via the Cape
    { p: [[0.304, 0.654], [0.278, 0.556], PAN, [0.311, 0.459], [0.389, 0.410], [0.461, 0.359], BIS, RTM], stop: 2, w: 2, syn: true }, // Chile
    { p: [[0.822, 0.702], [0.850, 0.556], [0.867, 0.445], [0.883, 0.350]], stop: -1, w: 2, syn: true },   // Pilbara -> Japan
    { p: [[0.508, 0.265], RTM], stop: -1, w: 1, syn: true },                                              // Iberia -> Germany
    { p: [[0.511, 0.362], [0.530, 0.278]], stop: -1, w: 1, syn: true },                                   // North Africa -> Italy
    { p: [[0.800, 0.295], [0.821, 0.317]], stop: -1, w: 1, syn: true },                                   // Inner Mongolia -> North China Plain
    // today's oil and LNG lanes
    { p: [Q, HZ, GO, BAB, SZ, [0.528, 0.364], GIB, BIS, RTM], stop: 1, w: 3 },                            // Gulf -> Europe
    { p: [Q, HZ, GO, [0.700, 0.500], SL, MAL, SCS, SH, JP], stop: 1, w: 3 },                               // Gulf -> China, Japan
    { p: [Q, HZ, GO, [0.700, 0.459]], stop: 1, w: 2 },                                                     // Gulf -> India
    { p: [[0.517, 0.515], [0.470, 0.450], GIB, BIS, RTM], stop: -1, w: 2 },                                // West Africa -> Europe
    { p: [USG, [0.261, 0.403], [0.361, 0.334], [0.450, 0.270], RTM], stop: -1, w: 2 },                    // US Gulf -> Europe
    { p: [USG, [0.258, 0.440], PAN, [0.200, 0.470], [0.120, 0.450], [0.02, 0.420]], stop: 2, w: 2 },      // US Gulf -> Asia via Panama
    { p: [[0.528, 0.160], RTM], stop: -1, w: 1 },                                                          // Norway -> Europe
    { p: [[0.939, 0.779], [0.922, 0.626], [0.900, 0.459], JP], stop: -1, w: 2 },                          // eastern Australia -> Japan
    { p: [[0.700, 0.459], SL, MAL, SCS, SH], stop: 4, w: 1 },                                             // India -> China through Malacca
  ];
  function pal() {
    const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
    return { accent: v("--accent"), accent2: v("--accent-2"), ink: v("--ink"), ink2: v("--ink-2"), ink3: v("--ink-3"), card: v("--card") };
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
  function chip(x, txt, px, py, col) {
    x.font = "600 12.5px Inter, sans-serif";
    const tw = x.measureText(txt).width;
    x.fillStyle = "rgba(255,255,255,0.92)"; x.strokeStyle = rgba(col, 0.5); x.lineWidth = 1;
    x.beginPath(); x.roundRect ? x.roundRect(px, py, tw + 22, 26, 13) : x.rect(px, py, tw + 22, 26); x.fill(); x.stroke();
    x.fillStyle = col; x.fillText(txt, px + 11, py + 17.5);
  }
  function along(pts, s) {           // point at fraction s of a polyline
    const seg = []; let L = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); L += l; }
    let d = s * L;
    for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const f = d / seg[i]; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f, i]; } d -= seg[i]; }
    const l = pts[pts.length - 1]; return [l[0], l[1], seg.length - 1];
  }
  // ?act=2 or ?act=3 in the page URL jumps straight to that act (handy for previews and screenshots)
  const jump = /[?&]act=([23])/.exec(location.search);
  let t = jump ? (jump[1] === "2" ? 380 : 700) : 0;
  const ships = [];
  function draw() {
    const [x, w, h] = fit(), P = pal();
    x.clearRect(0, 0, w, h);
    t += 1;
    const cyc = reduce ? 800 : t % 900;
    const act = cyc < 270 ? 1 : cyc < 560 ? 2 : 3;
    const S = ([u, v]) => [u * w, v * h];
    // today's oil and LNG lanes (the paper's own corridors are already drawn on the map)
    ROUTES.forEach((R) => {
      if (R.syn) return;
      x.setLineDash([3, 4]); x.lineWidth = 1.3;
      for (let i = 1; i < R.p.length; i++) {
        const cut = act >= 2 && R.stop >= 0 && i > R.stop;
        x.strokeStyle = cut ? rgba(RED, 0.35) : rgba(FOSSIL, 0.5);
        const [a1, b1] = S(R.p[i - 1]), [a2, b2] = S(R.p[i]);
        x.beginPath(); x.moveTo(a1, b1); x.lineTo(a2, b2); x.stroke();
      }
      x.setLineDash([]);
    });
    // act 3: build-first regions make synthetic fuel at home; export-oriented suppliers glow
    const k3 = act === 3 ? Math.min(1, (cyc - 560) / 60) : 0;
    if (k3 > 0) {
      EXPORT.forEach((e) => { const [px, py] = S([e.x, e.y]), r = 14 + 3 * Math.sin(t / 20);
        const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, rgba(P.accent, 0.5 * k3)); g.addColorStop(1, rgba(P.accent, 0));
        x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); });
      BUILD.forEach((b, i) => {
        const [px, py] = S([b.x, b.y]), ph = (t / 45 + i * 0.27) % 1;
        x.strokeStyle = rgba(P.accent2, (1 - ph) * 0.9 * k3); x.lineWidth = 2;
        x.beginPath(); x.arc(px, py, 5 + 14 * ph, 0, 7); x.stroke();
        x.fillStyle = rgba("#ffffff", 0.95 * k3); x.strokeStyle = rgba(P.accent2, k3); x.lineWidth = 2;
        x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill(); x.stroke();
        x.fillStyle = rgba(P.accent2, k3); x.beginPath(); x.arc(px, py, 2, 0, 7); x.fill();
      });
    }
    if (!reduce && Math.random() < 0.34) {
      // which fuel moves where: acts 1-2 carry only fossil fuel (blocked lanes still send ships that get stuck);
      // act 3 adds synthetic fuel on corridors that avoid the closed chokepoints, and fossil imports shrink
      const wts = ROUTES.map((R) => (act === 1 ? (R.syn ? 0 : R.w)
                                    : act === 2 ? (R.syn ? 0 : R.stop < 0 ? 2 : 1)
                                    : (R.syn ? (R.stop >= 0 ? 0 : R.detour ? 1 : 3) : 0.35)));
      let z = Math.random() * wts.reduce((a, b) => a + b, 0), r = 0;
      while (z > wts[r]) { z -= wts[r]; r++; }
      ships.push({ r, s: 0 });
    }
    for (let k = ships.length - 1; k >= 0; k--) {
      const sh = ships[k], R = ROUTES[sh.r];
      const [u, v, seg] = along(R.p, sh.s);
      const blocked = act >= 2 && R.stop >= 0 && seg >= R.stop;   // ships stop at the chokepoint
      if (blocked && sh.s < 0.98) { if (!sh.stuck) sh.stuck = t; if (t - sh.stuck > 60) { ships.splice(k, 1); continue; } }
      else sh.s += R.p.length > 6 ? 0.0024 : R.p.length > 3 ? 0.0036 : R.p.length > 2 ? 0.006 : 0.012;
      if (sh.s >= 1) { ships.splice(k, 1); continue; }
      const [px, py] = S([u, v]);
      x.fillStyle = blocked ? rgba(RED, 0.85) : R.syn ? P.accent : FOSSIL;
      x.beginPath(); x.arc(px, py, R.syn ? 3.4 : 2.8, 0, 7); x.fill();
      x.strokeStyle = "rgba(255,255,255,0.9)"; x.lineWidth = 1; x.stroke();
    }
    // act 2: chokepoints pulse; break marks on the routes
    if (act >= 2) {
      const k2 = Math.min(1, (cyc - 270) / 60);
      CHOKE.forEach((c, i) => {
        const [px, py] = S([c.x, c.y]), ph = (t / 30 + i * 0.4) % 1;
        x.strokeStyle = rgba(RED, (1 - ph) * 0.8 * k2); x.lineWidth = 2;
        x.beginPath(); x.arc(px, py, 6 + 18 * ph, 0, 7); x.stroke();
        x.fillStyle = rgba(RED, 0.9 * k2); x.beginPath(); x.arc(px, py, 4.5, 0, 7); x.fill();
        x.strokeStyle = rgba(RED, k2); x.lineWidth = 2.4; x.lineCap = "round";
        const cx2 = c.side > 0 ? px + 13 : px - 13;
        x.beginPath(); x.moveTo(cx2 - 4, py - 15); x.lineTo(cx2 + 4, py - 7); x.moveTo(cx2 + 4, py - 15); x.lineTo(cx2 - 4, py - 7); x.stroke();
        x.font = "700 11px Inter, sans-serif"; x.fillStyle = rgba(RED, k2);
        const tw = x.measureText(c.n).width;
        x.fillText(c.n, c.side > 0 ? px + 20 : px - 12 - tw, py - 6);
      });
    }
    // bars and caption live in the text column (no overlay on the map)
    drawBars(act, cyc, P);
    const cap = act === 1 ? ["① today: oil and LNG imports", "ink"]
              : act === 2 ? ["② chokepoints closed: imports cut", "red"]
              : ["③ build at home + trade with neighbors", "acc2"];
    if (capEl && capEl.dataset.k !== cap[1]) {
      capEl.dataset.k = cap[1]; capEl.textContent = cap[0];
      const cc = cap[1] === "red" ? RED : cap[1] === "ink" ? P.ink2 : P.accent2;
      capEl.style.color = cc; capEl.style.background = rgba(cc, 0.12);
    }
  }
  const capEl = document.getElementById("sig5cap"), bars = document.getElementById("sig5bars");
  function drawBars(act, cyc, P) {
    if (!bars) return;
    const r = bars.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    if (bars.width !== Math.round(r.width * d) || bars.height !== Math.round(r.height * d)) { bars.width = Math.round(r.width * d); bars.height = Math.round(r.height * d); }
    const x = bars.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0);
    const w = r.width, h = r.height; x.clearRect(0, 0, w, h);
    const prem = 0.62, sv = act === 1 ? 0.06 : act === 2 ? 0.06 + 0.86 * Math.min(1, (cyc - 300) / 230) : 0.92, net = prem - sv;
    const lx = 0, bx0 = 96, bw = w - bx0 - 6, zero = bx0 + bw * 0.24, unit = bw * 0.74;
    const row = (lbl, v, col, yy) => {
      x.font = "600 11.5px Inter, sans-serif"; x.fillStyle = P.ink2; x.fillText(lbl, lx, yy + 10);
      x.fillStyle = col; const a = zero, b = zero + v * unit; x.fillRect(Math.min(a, b), yy, Math.abs(b - a), 12);
    };
    row("cost premium", prem, WARM, 4);
    row("security value", sv, P.accent2, 26);
    row("net premium", net, net > 0 ? WARM : P.accent, 48);
    x.strokeStyle = P.ink3; x.lineWidth = 1; x.beginPath(); x.moveTo(zero, 0); x.lineTo(zero, 64); x.stroke();
    x.font = "10.5px Inter, sans-serif"; x.fillStyle = P.ink3; x.fillText("0", zero - 3, 74);
    if (net < 0) {
      x.save(); x.globalAlpha = Math.min(1, (-net) / 0.15); x.translate(w - 66, 56); x.rotate(-0.06);
      x.strokeStyle = P.accent; x.lineWidth = 1.6; x.strokeRect(-52, -12, 112, 20);
      x.font = "700 11px Inter, sans-serif"; x.fillStyle = P.accent; x.fillText("BUILD AT HOME ✓", -46, 3); x.restore();
    }
  }
  let visible = true, raf = 0;
  if ("IntersectionObserver" in window)
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible && !reduce) run(); }, { rootMargin: "100px" }).observe(cv);
  function run() { cancelAnimationFrame(raf); (function loop() { if (!visible) return; draw(); raf = requestAnimationFrame(loop); })(); }
  window.addEventListener("resize", draw);
  if (reduce) draw(); else run();
})();
