/* Animated side art for the home-page hero (wide screens only).
   Left  (trustworthy AI): a drifting constellation of nodes; nearby nodes link up, and signals travel along
         the links toward an output node wrapped in a certified (dashed) band.
   Right (optimization): a slowly rotating wireframe loss landscape; a point runs gradient descent across it
         and leaves a glowing trail, then restarts from a new spot.
   Both fade softly into the page at their edges. Colors follow the site's CSS variables (light/dark).
   Respects prefers-reduced-motion (one still frame) and pauses when the hero is off screen. */
(function () {
  const left = document.getElementById("heroArtLeft");
  const right = document.getElementById("heroArtRight");
  if (!left || !right) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function pal() {
    const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
    return { accent: v("--accent"), accent2: v("--accent-2"), ink2: v("--ink-2"), ink3: v("--ink-3"), bg: v("--bg") };
  }
  function rgba(col, a) {
    if (!col.startsWith("#")) return col;
    const h = col.length === 4 ? col.replace(/#(.)(.)(.)/, "#$1$1$2$2$3$3") : col;
    const n = parseInt(h.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function fit(c) {
    const r = c.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    if (c.width !== Math.round(r.width * d) || c.height !== Math.round(r.height * d)) {
      c.width = Math.max(1, Math.round(r.width * d)); c.height = Math.max(1, Math.round(r.height * d));
    }
    const x = c.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0);
    return [x, r.width, r.height];
  }
  // soft vignette so the art melts into the page instead of ending at a hard edge
  function vignette(x, w, h) {
    x.save(); x.globalCompositeOperation = "destination-in";
    const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.18, w / 2, h / 2, Math.max(w, h) * 0.62);
    g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(0.75, "rgba(0,0,0,0.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g; x.fillRect(0, 0, w, h); x.restore();
  }

  /* ---------- left: constellation network ---------- */
  const NODES = 42, nodes = [], sig = [];
  for (let i = 0; i < NODES; i++)
    nodes.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.0009, vy: (Math.random() - 0.5) * 0.0009,
                 r: 1.4 + Math.random() * 2.2, ph: Math.random() * 6.28 });
  const OUT = { x: 0.72, y: 0.5 };
  function drawLeft(t) {
    const [x, w, h] = fit(left), P = pal();
    x.clearRect(0, 0, w, h);
    const S = (n) => [n.x * w, n.y * h], link = Math.min(w, h) * 0.36;
    if (!reduce) nodes.forEach((n) => {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0.04 || n.x > 0.96) n.vx *= -1;
      if (n.y < 0.04 || n.y > 0.96) n.vy *= -1;
    });
    // links
    const edges = [];
    for (let i = 0; i < NODES; i++) for (let j = i + 1; j < NODES; j++) {
      const [ax, ay] = S(nodes[i]), [bx, by] = S(nodes[j]), d = Math.hypot(ax - bx, ay - by);
      if (d < link) {
        const a = (1 - d / link) * 0.55;
        const g = x.createLinearGradient(ax, ay, bx, by);
        g.addColorStop(0, rgba(P.accent, a)); g.addColorStop(1, rgba(P.accent2, a));
        x.strokeStyle = g; x.lineWidth = 0.9; x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke();
        edges.push([i, j]);
      }
    }
    // signals travelling along links toward the output
    if (!reduce && edges.length && Math.random() < 0.22) {
      const [i, j] = edges[Math.floor(Math.random() * edges.length)];
      const fwd = nodes[i].x < nodes[j].x;
      sig.push({ a: fwd ? i : j, b: fwd ? j : i, s: 0 });
    }
    for (let k = sig.length - 1; k >= 0; k--) {
      const q = sig[k]; q.s += 0.03;
      if (q.s >= 1) { sig.splice(k, 1); continue; }
      const [ax, ay] = S(nodes[q.a]), [bx, by] = S(nodes[q.b]);
      const px = ax + (bx - ax) * q.s, py = ay + (by - ay) * q.s;
      const g = x.createRadialGradient(px, py, 0, px, py, 7);
      g.addColorStop(0, rgba(P.accent2, 0.9)); g.addColorStop(1, rgba(P.accent2, 0));
      x.fillStyle = g; x.beginPath(); x.arc(px, py, 7, 0, 7); x.fill();
    }
    // nodes
    nodes.forEach((n) => {
      const [px, py] = S(n), tw = reduce ? 0.7 : 0.55 + 0.45 * Math.sin(t / 900 + n.ph);
      x.fillStyle = rgba(P.accent, 0.25 * tw); x.beginPath(); x.arc(px, py, n.r * 3.2, 0, 7); x.fill();
      x.fillStyle = rgba(P.accent, 0.55 + 0.4 * tw); x.beginPath(); x.arc(px, py, n.r, 0, 7); x.fill();
    });
    // output node with a certified band: the guarantee wraps the prediction
    const ox = OUT.x * w, oy = OUT.y * h, pulse = reduce ? 0 : Math.sin(t / 700);
    nodes.forEach((n) => { if (n.x < OUT.x) { const [px, py] = S(n), d = Math.hypot(px - ox, py - oy);
      if (d < link * 1.15) { x.strokeStyle = rgba(P.accent2, 0.18 * (1 - d / (link * 1.15))); x.lineWidth = 1; x.beginPath(); x.moveTo(px, py); x.lineTo(ox, oy); x.stroke(); } } });
    const g = x.createRadialGradient(ox, oy, 0, ox, oy, 26);
    g.addColorStop(0, rgba(P.accent2, 0.35)); g.addColorStop(1, rgba(P.accent2, 0));
    x.fillStyle = g; x.beginPath(); x.arc(ox, oy, 26, 0, 7); x.fill();
    x.fillStyle = P.accent2; x.beginPath(); x.arc(ox, oy, 4.5, 0, 7); x.fill();
    x.strokeStyle = rgba(P.accent2, 0.7); x.lineWidth = 1.2; x.setLineDash([3, 4]);
    x.beginPath(); x.arc(ox, oy, 15 + 2 * pulse, 0, 7); x.stroke();
    x.strokeStyle = rgba(P.accent2, 0.35);
    x.beginPath(); x.arc(ox, oy, 24 + 3 * pulse, t / 2600, t / 2600 + 4.4); x.stroke(); x.setLineDash([]);
    vignette(x, w, h);
  }

  /* ---------- right: wireframe loss landscape with gradient descent ---------- */
  const G = 26;
  // loss f(u, v) on [-1, 1]^2: a global basin, a shallow local basin and gentle ripples
  const f = (u, v) => 0.55 * (1 - Math.exp(-2.2 * ((u - 0.25) ** 2 + (v + 0.15) ** 2)))
                    - 0.18 * Math.exp(-9 * ((u + 0.55) ** 2 + (v - 0.5) ** 2)) + 0.04 * Math.sin(3 * u) * Math.cos(3 * v);
  const grad = (u, v) => { const e = 1e-3; return [(f(u + e, v) - f(u - e, v)) / (2 * e), (f(u, v + e) - f(u, v - e)) / (2 * e)]; };
  let ball = null;
  function newBall() { const a = Math.random() * 6.28; return { u: 0.85 * Math.cos(a), v: 0.85 * Math.sin(a), trail: [], rest: 0 }; }
  function drawRight(t) {
    const [x, w, h] = fit(right), P = pal();
    x.clearRect(0, 0, w, h);
    const ang = reduce ? 0.7 : 0.7 + t / 16000, tilt = 0.52, sc = Math.min(w, h * 1.25) * 0.38, cx = w / 2, cy = h * 0.62, zs = h * 0.40;
    const proj = (u, v, z) => {
      const ru = u * Math.cos(ang) - v * Math.sin(ang), rv = u * Math.sin(ang) + v * Math.cos(ang);
      return [cx + ru * sc, cy + rv * sc * tilt - z * zs, rv];
    };
    // mesh lines, nearer lines drawn stronger
    const lines = [];
    for (let i = 0; i < G; i++) {
      const a = [], b = [];
      for (let j = 0; j < G; j++) {
        const u1 = -1 + 2 * i / (G - 1), v1 = -1 + 2 * j / (G - 1);
        a.push(proj(u1, v1, f(u1, v1))); b.push(proj(v1, u1, f(v1, u1)));
      }
      lines.push(a, b);
    }
    lines.forEach((ln) => {
      x.beginPath(); ln.forEach(([px, py], k) => (k ? x.lineTo(px, py) : x.moveTo(px, py)));
      const depth = ln.reduce((s, p) => s + p[2], 0) / ln.length;
      x.strokeStyle = rgba(P.accent, 0.10 + 0.16 * (depth + 1) / 2); x.lineWidth = 0.9; x.stroke();
    });
    // gradient descent on the landscape
    if (!ball) ball = newBall();
    if (!reduce) {
      if (t % 2 < 1 || true) {
        const [gu, gv] = grad(ball.u, ball.v), lr = 0.07;
        const nu = Math.max(-1, Math.min(1, ball.u - lr * gu)), nv = Math.max(-1, Math.min(1, ball.v - lr * gv));
        if (Math.hypot(nu - ball.u, nv - ball.v) < 0.0006) { ball.rest++; if (ball.rest > 140) ball = newBall(); }
        else { ball.trail.push([ball.u, ball.v]); if (ball.trail.length > 90) ball.trail.shift(); ball.u = nu; ball.v = nv; }
      }
    }
    const tp = ball.trail.map(([u, v]) => proj(u, v, f(u, v)));
    tp.forEach(([px, py], k) => {
      if (!k) return; const [qx, qy] = tp[k - 1];
      x.strokeStyle = rgba(P.accent2, 0.15 + 0.75 * k / tp.length); x.lineWidth = 2.2;
      x.beginPath(); x.moveTo(qx, qy); x.lineTo(px, py); x.stroke();
    });
    const [bx, by] = proj(ball.u, ball.v, f(ball.u, ball.v));
    const g = x.createRadialGradient(bx, by, 0, bx, by, 16);
    g.addColorStop(0, rgba(P.accent2, 0.55)); g.addColorStop(1, rgba(P.accent2, 0));
    x.fillStyle = g; x.beginPath(); x.arc(bx, by, 16, 0, 7); x.fill();
    x.fillStyle = P.accent2; x.beginPath(); x.arc(bx, by, 4, 0, 7); x.fill();
    // global minimum marker
    const [mx, my] = proj(0.25, -0.15, f(0.25, -0.15));
    x.strokeStyle = rgba(P.accent, 0.55); x.lineWidth = 1; x.setLineDash([2, 3]);
    x.beginPath(); x.arc(mx, my, 7, 0, 7); x.stroke(); x.setLineDash([]);
    x.globalAlpha = 0.7; x.font = "italic 13px Fraunces, Georgia, serif"; x.fillStyle = P.ink3;
    x.fillText("x*", mx + 9, my + 4); x.fillText("∇f", bx + 9, by - 8); x.globalAlpha = 1;
    vignette(x, w, h);
  }

  let visible = true, raf = 0;
  const hero = document.getElementById("top");
  if ("IntersectionObserver" in window && hero)
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible && !reduce) loop(performance.now()); }).observe(hero);
  function frame(t) { drawLeft(t); drawRight(t); }
  function loop(t) { cancelAnimationFrame(raf); if (!visible) return; frame(t); raf = requestAnimationFrame(loop); }
  window.addEventListener("resize", () => frame(performance.now()));
  if (reduce) frame(0); else loop(performance.now());
})();
