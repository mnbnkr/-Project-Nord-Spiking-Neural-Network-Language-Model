"use strict";

// ────────────────────────────────────────────────────────────────────────────
// THEME  –  reads CSS variables dynamically, stays in sync with dark/light mode
// ────────────────────────────────────────────────────────────────────────────
function readTheme() {
  const s = getComputedStyle(document.documentElement);
  const g = (k) => s.getPropertyValue(k).trim();
  return {
    teal: g("--teal"),
    amber: g("--amber"),
    coral: g("--coral"),
    blue: g("--blue"),
    green: g("--green"),
    purple: g("--purple"),
    panel: g("--bg-panel"),
    card: g("--bg-card"),
    code: g("--bg-code"),
    code2: g("--bg-code2"),
    text: g("--text-main"),
    muted: g("--text-muted"),
    faint: g("--text-faint"),
    border: g("--border"),
    border2: g("--border2"),
  };
}
let T = readTheme();
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    T = readTheme();
  });

// ────────────────────────────────────────────────────────────────────────────
// CANVAS HELPER  –  proper DPR, ResizeObserver, no-accumulate transforms
// ────────────────────────────────────────────────────────────────────────────
class CH {
  constructor(id, height) {
    this.el = document.getElementById(id);
    this.h = height;
    this.dpr = window.devicePixelRatio || 1;
    this._w = 0;
    this._mx = -9999;
    this._my = -9999;
    new ResizeObserver(() => this._rs()).observe(this.el.parentElement);
    this._rs();
  }
  _rs() {
    const w = this.el.parentElement.getBoundingClientRect().width;
    if (Math.abs(w - this._w) < 0.5) return;
    this._w = w;
    this.el.width = Math.round(w * this.dpr);
    this.el.height = Math.round(this.h * this.dpr);
    this.el.style.height = this.h + "px";
  }
  get w() {
    return this._w;
  }
  // Returns a 2D ctx scaled to CSS pixels
  ctx() {
    const c = this.el.getContext("2d");
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    return c;
  }
  fill(c) {
    const ctx = this.ctx();
    ctx.fillStyle = c || T.panel;
    ctx.fillRect(0, 0, this._w, this.h);
    return ctx;
  }
  enableMouse() {
    this.el.style.cursor = "crosshair";
    this.el.addEventListener("mousemove", (e) => {
      const r = this.el.getBoundingClientRect();
      this._mx = e.clientX - r.left;
      this._my = e.clientY - r.top;
    });
    this.el.addEventListener("mouseleave", () => {
      this._mx = -9999;
      this._my = -9999;
    });
  }
  get mx() {
    return this._mx;
  }
  get my() {
    return this._my;
  }
}

// Utility: hex + alpha → rgba string
function rgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ────────────────────────────────────────────────────────────────────────────
// ANIMATION REGISTRY
// ────────────────────────────────────────────────────────────────────────────
const anims = [];
let gT = 0; // global time in seconds

// ════════════════════════════════════════════════════════════════════════
// 1. TEMPORAL ENCODER
// ════════════════════════════════════════════════════════════════════════
(function () {
  const ch = new CH("encCanvas", 380);

  anims.push((t) => {
    const ctx = ch.fill(T.panel);
    const W = ch.w,
      H = ch.h;

    // ── Embedding bar at bottom ──
    const embY = H - 72,
      embH = 36,
      embPad = Math.max(20, (W - 350) / 2); // dynamic horizontal pad
    const grad = ctx.createLinearGradient(embPad, 0, W - embPad, 0);
    grad.addColorStop(0, rgba(T.teal, 0.18));
    grad.addColorStop(0.35, rgba(T.blue, 0.2));
    grad.addColorStop(0.65, rgba(T.purple, 0.18));
    grad.addColorStop(1, rgba(T.amber, 0.18));
    ctx.fillStyle = grad;
    ctx.fillRect(embPad, embY, W - 2 * embPad, embH);
    ctx.strokeStyle = T.border2;
    ctx.lineWidth = 1;
    ctx.strokeRect(embPad, embY, W - 2 * embPad, embH);

    ctx.fillStyle = T.muted;
    ctx.font = "600 12px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText("x = temporal_proj(embed(token))  ∈ ℝ⁵¹²", W / 2, embY + 22);

    // ── 10 temporal current columns ──
    const nCols = 10;
    // Dynamic column width to fit smaller screens
    const colW = Math.max(12, Math.min(26, (W - 80) / nCols - 8));
    const totalW = nCols * colW + (nCols - 1) * 8;
    const startX = (W - totalW) / 2;
    const barBase = embY - 14;
    const maxFastH = barBase - 50; // fast bars can reach up to here
    const maxSlowH = maxFastH * 0.33;

    for (let i = 0; i < 10; i++) {
      const isSlow = i >= 8;
      const x = startX + i * (colW + 8);
      const cx = x + colW / 2;

      // Animated height  –  fast is volatile, slow is gentle
      let barH;
      if (isSlow) {
        barH = maxSlowH * (0.55 + 0.45 * Math.abs(Math.sin(t * 0.4 + i * 1.1)));
      } else {
        const raw = Math.sin(t * (1.2 + i * 0.15) + i * 0.9);
        barH = maxFastH * (0.25 + 0.75 * Math.abs(raw));
      }

      const col = isSlow ? T.amber : T.teal;
      const barY = barBase - barH;

      // Connector line from embedding to bar
      ctx.strokeStyle = rgba(col, 0.22);
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, embY);
      ctx.lineTo(cx, barBase);
      ctx.stroke();
      ctx.setLineDash([]);

      // Bar body
      const grd = ctx.createLinearGradient(x, barY, x, barBase);
      grd.addColorStop(0, rgba(col, 0.9));
      grd.addColorStop(1, rgba(col, 0.35));
      ctx.fillStyle = grd;
      ctx.fillRect(x, barY, colW, barH);

      // Bar top glow
      ctx.fillStyle = rgba(col, 0.95);
      ctx.fillRect(x, barY, colW, 3);

      // Timestep label
      ctx.fillStyle = T.muted;
      ctx.font = "600 10px IBM Plex Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`T${i + 1}`, cx, barBase + 12);
    }

    // ── Legend ──
    const isSmall = W < 500;
    ctx.font = "bold 12px IBM Plex Mono, monospace";
    if (isSmall) {
      ctx.textAlign = "center";
      ctx.fillStyle = T.teal;
      ctx.fillText("▮▮▮▮▮▮▮▮ T_fast × 8   scale=15", W / 2, 28);
      ctx.fillStyle = T.amber;
      ctx.fillText("▮▮ T_slow × 2   scale=5", W / 2, 46);
    } else {
      ctx.textAlign = "left";
      ctx.fillStyle = T.teal;
      ctx.fillText(
        "▮▮▮▮▮▮▮▮ T_fast × 8   scale = 15.0",
        Math.max(20, startX - 20),
        28,
      );
      ctx.fillStyle = T.amber;
      ctx.fillText(
        "▮▮ T_slow × 2   scale = 5.0",
        Math.max(20, startX - 20),
        48,
      );
    }

    // ── Amplitude bracket (fast) ──
    const fastRight = startX + 7 * (colW + 8) + colW + 6;
    ctx.strokeStyle = rgba(T.text, 0.18);
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(fastRight + 4, 70);
    ctx.lineTo(fastRight + 4, barBase);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = rgba(T.text, 0.4);
    ctx.font = "10px IBM Plex Mono, monospace";

    // Prevent overlap on right edge
    if (fastRight + 40 > W) {
      ctx.textAlign = "right";
      ctx.fillText("max~15", fastRight, (70 + barBase) / 2 + 4);
    } else {
      ctx.textAlign = "left";
      ctx.fillText("max~15", fastRight + 7, (70 + barBase) / 2 + 4);
    }
  });
})();

// ════════════════════════════════════════════════════════════════════════
// 2. LIF NEURON  –  bounded clipping to stop text overlaps
// ════════════════════════════════════════════════════════════════════════
(function () {
  const ch = new CH("lifCanvas", 380);

  // Pre-compute accurate LIF simulation matching nord_core.py
  const SIM = 2400;
  const data = []; // { v, isyn, spike, refrac }
  let v = -0.1,
    isyn = 0.0,
    refrac = 0;
  const tau_mem = 0.9,
    tau_syn = 0.5,
    v_thr = 0.25,
    v_rst = -0.1;

  for (let s = 0; s < SIM; s++) {
    const ph = s % 220;
    // Current burst: strong enough to guarantee spiking within burst
    const cur = ph > 25 && ph < 130 ? 0.3 : 0.0;

    if (refrac > 0) {
      // Refractory: clamp to v_reset
      isyn = tau_syn * isyn + cur;
      v = v_rst;
      refrac--;
      data.push({ v, isyn, spike: false, refrac: true });
    } else {
      isyn = tau_syn * isyn + cur;
      const v_new = tau_mem * v + (1.0 - tau_mem) * isyn;
      if (v_new >= v_thr) {
        data.push({ v: v_thr, isyn, spike: true, refrac: false });
        v = v_new - v_thr; // soft reset
        refrac = 2; // 2-timestep refractory
      } else {
        v = v_new;
        data.push({ v, isyn, spike: false, refrac: false });
      }
    }
  }
  // Also add cascade injection markers (every spike gets a cascade pulse)
  for (let i = 1; i < data.length; i++) {
    if (data[i - 1].spike) {
      data[i].cascade = true; // visual marker
    }
  }

  anims.push((t) => {
    const ctx = ch.fill(T.panel);
    const W = ch.w,
      H = ch.h;
    const PAD = 14,
      LBL = 80; // Extended label width so threshold tags stay cleanly outside
    const offset = Math.floor(t * 55) % SIM; // scroll speed

    // Three horizontal tracks
    const trackH = (H - PAD * 2 - 20) / 3;
    const vTrackY = PAD;
    const iTrackY = PAD + trackH + 16;
    const spkTrackY = PAD + trackH * 2 + 32;
    const plotW = W - LBL - PAD;

    // ── Static Left Labels ──
    ctx.font = "600 11px IBM Plex Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = T.teal;
    ctx.fillText("v_mem", LBL - 8, vTrackY + trackH / 2 + 4);
    ctx.fillStyle = T.green;
    ctx.fillText("i_syn", LBL - 8, iTrackY + trackH / 2 + 4);
    ctx.fillStyle = T.coral;
    ctx.fillText("spikes", LBL - 8, spkTrackY + 16);

    // Helpers
    function trackY(val, trackTop, lo, hi) {
      return trackTop + trackH - ((val - lo) / (hi - lo)) * trackH;
    }
    const vLo = -0.15,
      vHi = 0.35;
    const iLo = 0,
      iHi = 0.32;

    const thY = trackY(v_thr, vTrackY, vLo, vHi);
    const rstY = trackY(v_rst, vTrackY, vLo, vHi);

    // Static left labels for thresholds (cleanly aligned outside the graph)
    ctx.font = "600 10px IBM Plex Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = rgba(T.coral, 0.9);
    ctx.fillText("thresh 0.25", LBL - 8, thY + 4);
    ctx.fillStyle = T.muted;
    ctx.fillText("reset −0.1", LBL - 8, rstY + 4);

    // ── Apply Clipping Mask so graph data NEVER touches the left labels ──
    ctx.save();
    ctx.beginPath();
    ctx.rect(LBL, 0, plotW, H);
    ctx.clip();

    // ── Background / refractory shading ──
    for (let px = 0; px < plotW; px++) {
      const d = data[(offset + px) % SIM];
      if (d.refrac) {
        ctx.fillStyle = rgba(T.coral, 0.06);
        ctx.fillRect(LBL + px, vTrackY, 1, trackH + 2);
        ctx.fillRect(LBL + px, iTrackY, 1, trackH + 2);
      }
      if (d.cascade) {
        ctx.fillStyle = rgba(T.amber, 0.3);
        ctx.fillRect(LBL + px, iTrackY, 2, trackH);
      }
    }

    // ── Threshold & resting guide lines ──
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(T.coral, 0.6);
    ctx.beginPath();
    ctx.moveTo(LBL, thY);
    ctx.lineTo(LBL + plotW, thY);
    ctx.stroke();
    ctx.strokeStyle = rgba(T.border2, 0.7);
    ctx.beginPath();
    ctx.moveTo(LBL, rstY);
    ctx.lineTo(LBL + plotW, rstY);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── v_mem trace ──
    ctx.beginPath();
    ctx.strokeStyle = T.teal;
    ctx.lineWidth = 2.2;
    for (let px = 0; px < plotW; px++) {
      const d = data[(offset + px) % SIM];
      const y = trackY(d.v, vTrackY, vLo, vHi);
      px === 0 ? ctx.moveTo(LBL + px, y) : ctx.lineTo(LBL + px, y);
    }
    ctx.stroke();

    // ── i_syn trace ──
    ctx.beginPath();
    ctx.strokeStyle = T.green;
    ctx.lineWidth = 1.8;
    for (let px = 0; px < plotW; px++) {
      const d = data[(offset + px) % SIM];
      const y = trackY(d.isyn, iTrackY, iLo, iHi);
      px === 0 ? ctx.moveTo(LBL + px, y) : ctx.lineTo(LBL + px, y);
    }
    ctx.stroke();

    // ── Spike raster ──
    for (let px = 0; px < plotW; px++) {
      const d = data[(offset + px) % SIM];
      if (d.spike) {
        ctx.strokeStyle = T.coral;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(LBL + px, spkTrackY + 4);
        ctx.lineTo(LBL + px, spkTrackY + 26);
        ctx.stroke();
        // SPIKE label above membrane trace
        ctx.fillStyle = rgba(T.coral, 0.9);
        ctx.font = "bold 9px IBM Plex Mono, monospace";
        ctx.textAlign = "center";
        ctx.fillText("▲", LBL + px, thY - 10);
      }
    }

    // ── Cascade annotation ──
    ctx.fillStyle = rgba(T.amber, 0.65);
    ctx.font = "600 10px IBM Plex Mono, monospace";
    // Dynamic alignment so it doesn't break right edge
    const cascX = LBL + plotW * 0.55;
    ctx.textAlign = cascX > W - 100 ? "right" : "left";
    ctx.fillText("↑ cascade inject", cascX, iTrackY + trackH + 2);

    ctx.restore(); // end clip

    // ── Track separators ──
    ctx.strokeStyle = rgba(T.border2, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LBL, 0);
    ctx.lineTo(LBL, H);
    ctx.stroke();
  });
})();

// ════════════════════════════════════════════════════════════════════════
// 3. CASCADE RING  –  inherently responsive radius logic
// ════════════════════════════════════════════════════════════════════════
(function () {
  const ch = new CH("casCanvas", 440);
  ch.enableMouse();

  const N = 64;
  const R = 3;
  const mem = new Float32Array(N).fill(0);
  const isyn = new Float32Array(N).fill(0);
  const W_mat = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => {
      const d = Math.min(Math.abs(i - j), N - Math.abs(i - j));
      return d > 0 && d <= R ? (1 - d / (R + 1)) * 0.8 : 0;
    }),
  );

  let lastFireT = -1;
  let autoFireCooldown = 0;

  anims.push((t) => {
    const ctx = ch.fill(T.panel);
    const W = ch.w,
      H = ch.h;
    const cx = W / 2,
      cy = H / 2;
    const ringR = Math.min(W, H) * 0.34;
    const nodeR = Math.max(3, ringR * 0.04);

    for (let i = 0; i < N; i++) {
      isyn[i] *= 0.85;
      mem[i] *= 0.8;
      if (mem[i] < 0) mem[i] = 0;
    }

    let hovered = -1;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      const nx = cx + Math.cos(a) * ringR;
      const ny = cy + Math.sin(a) * ringR;
      if (Math.hypot(ch.mx - nx, ch.my - ny) < nodeR + 6) {
        hovered = i;
        break;
      }
    }

    if (hovered >= 0 && t - lastFireT > 0.08) {
      lastFireT = t;
      mem[hovered] = 1.5;
      for (let j = 0; j < N; j++) isyn[j] += W_mat[hovered][j] * 0.8;
    }

    autoFireCooldown -= 1;
    if (autoFireCooldown <= 0) {
      autoFireCooldown = 55 + Math.floor(Math.random() * 60);
      const f = Math.floor(Math.random() * N);
      mem[f] = 1.4;
      for (let j = 0; j < N; j++) isyn[j] += W_mat[f][j] * 0.7;
    }

    for (let i = 0; i < N; i++) mem[i] = Math.min(mem[i] + isyn[i] * 0.2, 2.0);

    ctx.strokeStyle = rgba(T.border2, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < N; i++) {
      for (let off = 1; off <= 2; off++) {
        const j = (i + off) % N;
        const w = W_mat[i][j];
        if (w < 0.01) continue;
        const a1 = (i / N) * Math.PI * 2 - Math.PI / 2;
        const a2 = (j / N) * Math.PI * 2 - Math.PI / 2;
        const x1 = cx + Math.cos(a1) * ringR;
        const y1 = cy + Math.sin(a1) * ringR;
        const x2 = cx + Math.cos(a2) * ringR;
        const y2 = cy + Math.sin(a2) * ringR;
        const act = Math.max(mem[i], mem[j]);
        const alpha = 0.06 + act * 0.18;
        ctx.strokeStyle =
          act > 0.3 ? rgba(T.teal, alpha) : rgba(T.border2, 0.08);
        ctx.lineWidth = w * 1.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      const nx = cx + Math.cos(a) * ringR;
      const ny = cy + Math.sin(a) * ringR;
      const m = mem[i];
      const syn = isyn[i];

      let nodeColor,
        glowColor,
        glowR = 0;
      if (m > 1.0) {
        nodeColor = T.coral;
        glowColor = rgba(T.coral, 0.3);
        glowR = nodeR + 8;
      } else if (syn > 0.08 || m > 0.08) {
        const frac = Math.min((m + syn) / 0.9, 1);
        nodeColor = T.teal;
        glowColor = rgba(T.teal, 0.15 + frac * 0.25);
        glowR = nodeR + 3 + frac * 5;
      } else {
        nodeColor = T.code;
        glowColor = null;
      }

      if (glowR > 0) {
        const grd = ctx.createRadialGradient(
          nx,
          ny,
          nodeR * 0.5,
          nx,
          ny,
          glowR,
        );
        grd.addColorStop(0, glowColor);
        grd.addColorStop(1, "transparent");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(nx, ny, glowR, 0, Math.PI * 2);
        ctx.fill();
      }

      const nodeSize = nodeR + m * 3;
      ctx.fillStyle = nodeColor;
      ctx.beginPath();
      ctx.arc(nx, ny, nodeSize, 0, Math.PI * 2);
      ctx.fill();

      if (m > 0.15) {
        ctx.fillStyle = rgba("#ffffff", Math.min(m, 0.8));
        ctx.beginPath();
        ctx.arc(nx, ny, Math.min(nodeSize * 0.4, 3), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = T.muted;
    ctx.font = "bold 13px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText("64 Clusters", cx, cy - 12);
    ctx.font = "10px IBM Plex Mono, monospace";
    ctx.fillStyle = T.faint;
    ctx.fillText("D = 512 neurons / 64 = 8 per cluster", cx, cy + 8);
    ctx.fillText("radius = 3, gain = learnable", cx, cy + 24);

    const active = mem.filter((m) => m > 0.15).length;
    ctx.fillStyle = T.teal;
    ctx.font = "600 11px IBM Plex Mono, monospace";
    // Safe Y height guarantees no collision with nodes
    ctx.fillText(
      `active clusters: ${active} / 64  (${((active / 64) * 100).toFixed(0)}%)`,
      cx,
      Math.max(16, cy - ringR - 20),
    );
  });
})();

// ════════════════════════════════════════════════════════════════════════
// 4. RESONANCE  –  fully responsive scaling and safe legend placement
// ════════════════════════════════════════════════════════════════════════
(function () {
  const ch = new CH("resCanvas", 400);

  const SEQ = 10,
    T_total = 10,
    TOP_K = 3;
  const qPat = Array.from({ length: SEQ }, () =>
    Array.from({ length: T_total }, () => (Math.random() < 0.35 ? 1 : 0)),
  );
  const kPat = Array.from({ length: SEQ }, () =>
    Array.from({ length: T_total }, () => (Math.random() < 0.35 ? 1 : 0)),
  );
  const res = Array.from({ length: SEQ }, (_, i) =>
    Array.from({ length: SEQ }, (_, j) => {
      if (j > i) return null;
      return qPat[i].reduce((acc, q, t) => acc + q * kPat[j][t], 0);
    }),
  );
  const topK = Array.from({ length: SEQ }, (_, i) => {
    const row = res[i].map((v, j) => ({ v, j })).filter((x) => x.v !== null);
    row.sort((a, b) => b.v - a.v);
    return new Set(row.slice(0, TOP_K).map((x) => x.j));
  });

  anims.push((t) => {
    const ctx = ch.fill(T.panel);
    const W = ch.w,
      H = ch.h;

    // Dynamically scale based on W
    const isSmall = W < 500;
    const scale = isSmall ? Math.max(0.6, W / 500) : 1.0;

    const SPIKE_W = 14 * scale;
    const SPIKE_H = 14 * scale;
    const HEAT_CELL = 28 * scale;
    const marginLeft = isSmall ? 35 : 80;
    const marginTop = 44;
    const heatLeft = marginLeft + T_total * SPIKE_W + (isSmall ? 10 : 20);
    const heatTop = marginTop;
    const scanRow = Math.floor(t * 0.8) % SEQ;

    // ── Q spike patterns ──
    ctx.fillStyle = T.muted;
    ctx.font = "600 11px IBM Plex Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillText("Q spikes", marginLeft - 4, marginTop - 8);

    for (let i = 0; i < SEQ; i++) {
      const y = heatTop + i * HEAT_CELL;
      ctx.fillStyle = rgba(T.border2, 0.3);
      ctx.fillRect(marginLeft, y + 2, T_total * SPIKE_W, HEAT_CELL - 4);
      for (let tt = 0; tt < T_total; tt++) {
        if (qPat[i][tt]) {
          const isScan = i === scanRow;
          ctx.fillStyle = isScan ? T.teal : rgba(T.teal, 0.55);
          ctx.fillRect(
            marginLeft + tt * SPIKE_W + 1,
            y + 4,
            SPIKE_W - 2,
            HEAT_CELL - 8,
          );
        }
      }
      ctx.fillStyle = T.faint;
      ctx.font = "10px IBM Plex Mono, monospace";
      ctx.textAlign = "right";
      ctx.fillText(`S${i}`, marginLeft - 4, y + HEAT_CELL / 2 + 4);
    }
    ctx.fillStyle = T.faint;
    ctx.font = "10px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      "T=0 → T=9",
      marginLeft + (T_total * SPIKE_W) / 2,
      heatTop + SEQ * HEAT_CELL + 14,
    );

    // ── K spike patterns ──
    ctx.fillStyle = T.muted;
    ctx.font = "600 11px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      "K spikes (past tokens)",
      heatLeft + (SEQ * HEAT_CELL) / 2,
      marginTop - 22,
    );

    for (let j = 0; j < SEQ; j++) {
      const x = heatLeft + j * HEAT_CELL;
      for (let tt = 0; tt < T_total; tt++) {
        if (kPat[j][tt]) {
          ctx.fillStyle = rgba(T.amber, 0.55);
          ctx.fillRect(
            x + 2,
            marginTop - T_total * SPIKE_H - 4 + tt * SPIKE_H,
            HEAT_CELL - 4,
            SPIKE_H - 1,
          );
        }
      }
      ctx.fillStyle = T.faint;
      ctx.font = "10px IBM Plex Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`S${j}`, x + HEAT_CELL / 2, marginTop - 3);
    }

    // ── Resonance heatmap ──
    const maxRes = T_total * 0.35;
    for (let i = 0; i < SEQ; i++) {
      for (let j = 0; j < SEQ; j++) {
        const x = heatLeft + j * HEAT_CELL;
        const y = heatTop + i * HEAT_CELL;
        if (j > i) {
          ctx.fillStyle = rgba(T.code, 0.7);
          ctx.fillRect(x, y, HEAT_CELL, HEAT_CELL);
          continue;
        }
        const v = res[i][j];
        const norm = v / maxRes;
        const isScan = i === scanRow;
        const isTop = topK[i].has(j);
        const isProcessed = i < scanRow;
        let cellColor;
        if (isProcessed) {
          cellColor = isTop
            ? rgba(T.teal, 0.15 + norm * 0.6)
            : rgba(T.code, 0.9);
        } else if (isScan) {
          cellColor = rgba(T.coral, 0.1 + norm * 0.55);
        } else {
          cellColor = rgba(T.border2, 0.12 + norm * 0.22);
        }
        ctx.fillStyle = cellColor;
        ctx.fillRect(x, y, HEAT_CELL, HEAT_CELL);
        ctx.strokeStyle = rgba(T.border, 0.3);
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, HEAT_CELL, HEAT_CELL);
        if (isProcessed && isTop) {
          ctx.fillStyle = T.teal;
          ctx.font = "bold 10px IBM Plex Mono, monospace";
          ctx.textAlign = "center";
          ctx.fillText(v, x + HEAT_CELL / 2, y + HEAT_CELL / 2 + 4);
        }
      }
    }

    const scanY = heatTop + scanRow * HEAT_CELL;
    ctx.strokeStyle = rgba(T.coral, 0.7);
    ctx.lineWidth = 2;
    ctx.strokeRect(heatLeft, scanY, SEQ * HEAT_CELL, HEAT_CELL);

    // ── Axis labels & Legend dynamically placed ──
    let lx, ly;
    if (isSmall) {
      lx = marginLeft;
      ly = heatTop + SEQ * HEAT_CELL + 30;
      ctx.textAlign = "center";
      ctx.fillStyle = T.muted;
      ctx.fillText(
        "Resonance matrix",
        heatLeft + (SEQ * HEAT_CELL) / 2,
        ly + 26,
      );
    } else {
      lx = heatLeft + SEQ * HEAT_CELL + 16;
      ly = marginTop + 16;
      ctx.textAlign = "center";
      ctx.fillStyle = T.muted;
      ctx.fillText(
        "Resonance matrix  (co-firing dot product)",
        heatLeft + (SEQ * HEAT_CELL) / 2,
        H - 12,
      );
    }

    ctx.fillStyle = T.teal;
    ctx.font = "600 10px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText("■ top-K kept", lx, ly);
    ctx.fillStyle = rgba(T.coral, 0.8);
    ctx.fillText("■ scanning", lx, ly + 16);
    ctx.fillStyle = rgba(T.code, 0.8);
    ctx.fillText("■ zeroed (masked)", lx, ly + 32);
    ctx.fillStyle = T.faint;
    ctx.fillText("■ future (causal)", lx, ly + 48);
    ctx.fillText(`top-K = ${TOP_K}`, lx, ly + 70);
  });
})();

// ════════════════════════════════════════════════════════════════════════
// 5. STDP  –  dynamically bounded trace width & safe text alignment
// ════════════════════════════════════════════════════════════════════════
(function () {
  const ch = new CH("stdpCanvas", 420);

  const LEN = 600;
  const a_plus = 0.005,
    a_minus = 0.005,
    tau_plus = 20,
    tau_minus = 20;
  const decay_p = Math.exp(-1 / tau_plus),
    decay_m = Math.exp(-1 / tau_minus);
  const pre = new Float32Array(LEN),
    post = new Float32Array(LEN);
  const trPre = new Float32Array(LEN),
    trPost = new Float32Array(LEN),
    dW = new Float32Array(LEN);
  [60, 180, 300, 420, 510].forEach((t) => (pre[t] = 1));
  [90, 210, 330, 450, 540].forEach((t) => (post[t] = 1));

  let tp = 0,
    tm = 0,
    w = 0;
  for (let i = 0; i < LEN; i++) {
    tp = tp * decay_p + pre[i];
    tm = tm * decay_m + post[i];
    trPre[i] = tp;
    trPost[i] = tm;
    if (post[i]) w += a_plus * tp;
    if (pre[i]) w -= a_minus * tm;
    dW[i] = w;
  }

  const reward = new Float32Array(LEN);
  let lossEMA = 4.0;
  for (let i = 0; i < LEN; i++) {
    const loss = 4.0 - 0.6 * Math.sin(i / 120) + 0.2 * Math.random();
    lossEMA = 0.99 * lossEMA + 0.01 * loss;
    reward[i] = 1 / (1 + Math.exp(-(lossEMA - loss) * 2));
  }

  anims.push((t) => {
    const ctx = ch.fill(T.panel);
    const W = ch.w,
      H = ch.h;

    const offset = Math.floor(t * 50) % LEN;
    const PAD = 14,
      LBL = 90; // Widened so text labels never cut off on the left
    const rightPad = 85; // Fixed width guarantees no wasted space while fitting legend safely
    const plotW = W - LBL - rightPad;
    const nTracks = 4;
    const trackH = (H - PAD * 2 - 24) / nTracks;

    const trackTops = [
      PAD,
      PAD + trackH + 6,
      PAD + (trackH + 6) * 2,
      PAD + (trackH + 6) * 3,
    ];
    const labels = ["pre  spikes", "pre  trace", "post trace", "reward × ΔW"];
    const colors = [T.coral, rgba(T.coral, 0.7), rgba(T.teal, 0.8), T.green];

    ctx.font = "600 10px IBM Plex Mono, monospace";
    for (let tr = 0; tr < nTracks; tr++) {
      ctx.fillStyle = colors[tr];
      ctx.textAlign = "right";
      ctx.fillText(labels[tr], LBL - 4, trackTops[tr] + trackH / 2 + 4);
      ctx.fillStyle = rgba(T.border, 0.2);
      ctx.fillRect(LBL, trackTops[tr], plotW, trackH);
    }

    // ── Bounded plot area ──
    ctx.save();
    ctx.beginPath();
    ctx.rect(LBL, 0, plotW, H);
    ctx.clip();

    // Track 0
    for (let px = 0; px < plotW; px++) {
      if (data_sample(pre, offset, px, LEN) > 0.5) {
        ctx.fillStyle = T.coral;
        ctx.fillRect(LBL + px, trackTops[0] + 4, 2, trackH - 8);
      }
      if (data_sample(post, offset, px, LEN) > 0.5) {
        ctx.fillStyle = T.teal;
        ctx.fillRect(LBL + px, trackTops[0] + trackH * 0.55, 2, trackH * 0.38);
      }
    }
    ctx.fillStyle = T.teal;
    ctx.font = "9px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText("post ▲", LBL + 4, trackTops[0] + trackH - 3);

    // Traces
    draw_trace(
      ctx,
      trPre,
      offset,
      LEN,
      LBL,
      trackTops[1],
      plotW,
      trackH,
      0,
      1.2,
      rgba(T.coral, 0.8),
      1.5,
    );
    draw_trace(
      ctx,
      trPost,
      offset,
      LEN,
      LBL,
      trackTops[2],
      plotW,
      trackH,
      0,
      1.2,
      rgba(T.teal, 0.8),
      1.5,
    );

    // Bar chart
    const maxdW = Math.max(...dW) + 0.001;
    for (let px = 0; px < plotW; px++) {
      const w_val = data_sample(dW, offset, px, LEN),
        r_val = data_sample(reward, offset, px, LEN);
      const norm = (w_val * (2 * r_val - 1)) / maxdW;
      const barH = Math.abs(norm) * (trackH * 0.5);
      const cy_t = trackTops[3] + trackH / 2;
      ctx.fillStyle = norm > 0 ? rgba(T.green, 0.75) : rgba(T.coral, 0.55);
      ctx.fillRect(LBL + px, cy_t - barH, 1, barH * 2);
    }
    ctx.strokeStyle = rgba(T.border2, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LBL, trackTops[3] + trackH / 2);
    ctx.lineTo(LBL + plotW, trackTops[3] + trackH / 2);
    ctx.stroke();

    ctx.restore(); // end clip

    // ── Axes and Text (Safe Zone) ──
    const tx = LBL + plotW + 12;
    ctx.fillStyle = T.faint;
    ctx.font = "10px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText("LTP +", tx, trackTops[3] + trackH / 2 - 4);
    ctx.fillStyle = rgba(T.coral, 0.6);
    ctx.fillText("LTD −", tx, trackTops[3] + trackH / 2 + 14);

    ctx.fillStyle = T.muted;
    ctx.fillText("dW_final =", tx, trackTops[3] + trackH - 16);
    ctx.fillText("dW×(2·rew−1)", tx, trackTops[3] + trackH - 4);

    ctx.strokeStyle = rgba(T.border2, 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LBL, 0);
    ctx.lineTo(LBL, H);
    ctx.stroke();
  });

  function data_sample(arr, offset, px, len) {
    return arr[(offset + px) % len];
  }
  function draw_trace(
    ctx,
    arr,
    offset,
    len,
    lx,
    ty,
    pw,
    th,
    lo,
    hi,
    color,
    lw,
  ) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    for (let px = 0; px < pw; px++) {
      const y = ty + th - ((arr[(offset + px) % len] - lo) / (hi - lo)) * th;
      px === 0 ? ctx.moveTo(lx + px, y) : ctx.lineTo(lx + px, y);
    }
    ctx.stroke();
  }
})();

// ════════════════════════════════════════════════════════════════════════
// 6. LEAKY CLAMP  –  fixed scale radius to mathematically prevent overlap
// ════════════════════════════════════════════════════════════════════════
(function () {
  const ch = new CH("lkyCanvas", 340);

  anims.push((t) => {
    const ctx = ch.fill(T.panel);
    const W = ch.w,
      H = ch.h;

    const PAD = 48;
    // Ensure scale absolutely prevents plots colliding
    const scale = Math.min((H - PAD * 2) * 0.45, W / 7.5);
    const cxL = PAD + (W / 2 - PAD) * 0.5;
    const cxR = W / 2 + (W / 2 - PAD) * 0.5;
    const baseY = H / 2 + 20;
    const floor = -0.1,
      leak = 0.1;

    for (const cx of [cxL, cxR]) {
      ctx.strokeStyle = rgba(T.border2, 0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - scale * 1.3, baseY);
      ctx.lineTo(cx + scale * 1.3, baseY);
      ctx.moveTo(cx, baseY + scale * 1.15);
      ctx.lineTo(cx, baseY - scale * 1.15);
      ctx.stroke();
      ctx.fillStyle = T.faint;
      ctx.font = "10px IBM Plex Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText("0", cx + 5, baseY + 13);
      ctx.fillText("x", cx + scale * 1.2, baseY + 13);
      ctx.textAlign = "right";
      ctx.fillText("f(x)", cx - 4, baseY - scale * 1.1 + 10);
    }

    ctx.fillStyle = T.muted;
    ctx.font = `bold ${Math.max(10, Math.min(13, W / 40))}px IBM Plex Mono, monospace`;
    ctx.textAlign = "center";
    ctx.fillText("ReLU  (standard)", cxL, PAD - 12);

    ctx.strokeStyle = rgba(T.coral, 0.7);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cxL - scale * 1.2, baseY);
    ctx.lineTo(cxL, baseY);
    ctx.lineTo(cxL + scale * 1.1, baseY - scale * 1.1);
    ctx.stroke();

    const arrowY = baseY - 15;
    ctx.fillStyle = rgba(T.coral, 0.8);
    ctx.font = "11px IBM Plex Mono, monospace";
    ctx.fillText("0 (DEAD)", cxL - scale * 0.6, arrowY);
    ctx.strokeStyle = rgba(T.coral, 0.4);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(cxL - scale * 0.4, arrowY + 2);
    ctx.lineTo(cxL - scale * 0.05, baseY - 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = T.teal;
    ctx.font = `bold ${Math.max(10, Math.min(13, W / 40))}px IBM Plex Mono, monospace`;
    ctx.fillText("LeakyClamp  (Nord)", cxR, PAD - 12);

    const floorY = baseY - floor * scale;
    ctx.strokeStyle = rgba(T.amber, 0.55);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cxR - scale * 1.2, floorY);
    ctx.lineTo(cxR + scale * 0.1, floorY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = T.amber;
    ctx.font = "10px IBM Plex Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillText("floor = −0.1", cxR - scale * 0.8, floorY - 5);

    ctx.strokeStyle = T.teal;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const x_val = -1.3 + (i / 200) * 2.6;
      const y_val = x_val >= 0 ? x_val : Math.max(leak * x_val, floor);
      const px = cxR + x_val * scale,
        py = baseY - y_val * scale;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.fillStyle = rgba(T.teal, 0.7);
    ctx.font = "11px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`slope = leak ≈ ${leak}`, cxR - scale * 1.1, baseY + 40);

    const phase = (t % 4.0) / 4.0;
    const x_anim = -1.2 + phase * 2.4;
    for (const [cx_dot, type] of [
      [cxL, "relu"],
      [cxR, "lky"],
    ]) {
      const y_anim =
        x_anim >= 0
          ? x_anim
          : type === "relu"
            ? 0
            : Math.max(leak * x_anim, floor);
      const px = cx_dot + x_anim * scale,
        py = baseY - y_anim * scale;
      const grd = ctx.createRadialGradient(px, py, 2, px, py, 14);
      grd.addColorStop(0, rgba(type === "relu" ? T.coral : T.teal, 0.5));
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = type === "relu" ? T.coral : T.teal;
      ctx.beginPath();
      ctx.arc(px, py, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = rgba(T.border2, 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2, PAD);
    ctx.lineTo(W / 2, H - PAD);
    ctx.stroke();
  });
})();

// ════════════════════════════════════════════════════════════════════════
// 7. EMA TEMPORAL READOUT  –  fully responsive to prevent squeezed cells
// ════════════════════════════════════════════════════════════════════════
(function () {
  const ch = new CH("emaCanvas", 380);
  const T_total = 10,
    alpha = 0.8,
    DIMS = 16;
  const weights = Array.from(
    { length: T_total },
    (_, t) => (1 - alpha) * Math.pow(alpha, T_total - 1 - t),
  );
  const vMem = Array.from({ length: T_total }, (_, t) =>
    Array.from(
      { length: DIMS },
      (_, d) => 0.15 * Math.sin(t * 0.7 + d * 0.5) + 0.05,
    ),
  );
  const emaOut = new Array(DIMS).fill(0);
  for (let t = 0; t < T_total; t++) {
    for (let d = 0; d < DIMS; d++) {
      emaOut[d] = alpha * emaOut[d] + (1 - alpha) * vMem[t][d];
    }
  }

  anims.push((t) => {
    const ctx = ch.fill(T.panel);
    const W = ch.w,
      H = ch.h;

    const PAD = 20;
    const isSmall = W < 500;
    const LBL_W = 45; // reduced label margin
    const rightMargin = isSmall ? PAD : 140;
    const cellW = Math.max(
      8,
      Math.min(28, (W - PAD - rightMargin - LBL_W) / DIMS),
    );
    const cellH = 22,
      gridTop = PAD + 16,
      gridLeft = PAD + LBL_W;
    const scanT = Math.floor(t * 0.9) % T_total;

    ctx.fillStyle = T.faint;
    ctx.font = "9px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    for (let d = 0; d < DIMS; d++) {
      ctx.fillText(`D${d}`, gridLeft + d * cellW + cellW / 2, gridTop - 6);
    }

    for (let tt = 0; tt < T_total; tt++) {
      const rowY = gridTop + tt * (cellH + 3),
        isScan = tt === scanT;
      ctx.textAlign = "right";
      ctx.fillStyle = isScan ? T.text : T.muted;
      ctx.font = `${isScan ? "bold " : " "}10px IBM Plex Mono, monospace`;
      ctx.fillText(`T${tt}`, gridLeft - 36, rowY + cellH / 2 + 4);

      const wFrac = weights[tt] / weights[T_total - 1];
      ctx.fillStyle = rgba(T.teal, 0.15 + wFrac * 0.25);
      ctx.fillRect(gridLeft - 34, rowY + 2, 28 * wFrac, cellH - 4);
      ctx.fillStyle = rgba(T.teal, 0.8);
      ctx.font = "8px IBM Plex Mono, monospace";
      ctx.textAlign = "right";
      ctx.fillText(weights[tt].toFixed(3), gridLeft - 2, rowY + cellH / 2 + 4);

      for (let d = 0; d < DIMS; d++) {
        const v = vMem[tt][d] + (isScan ? 0.02 * Math.sin(t * 3 + d) : 0);
        const norm = (v + 0.2) / 0.5;
        const cellBg = isScan
          ? rgba(T.coral, 0.1 + norm * 0.35)
          : rgba(T.teal, 0.05 + norm * 0.25 * (0.3 + (tt / T_total) * 0.5));
        ctx.fillStyle = cellBg;
        ctx.fillRect(gridLeft + d * cellW, rowY, cellW - 1, cellH);
      }
    }

    const outY = gridTop + T_total * (cellH + 3) + 14;
    ctx.fillStyle = T.teal;
    ctx.font = "bold 11px IBM Plex Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillText("EMA out", gridLeft - 2, outY + cellH / 2 + 4);

    ctx.strokeStyle = rgba(T.teal, 0.4);
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(gridLeft + (DIMS * cellW) / 2, gridTop + T_total * (cellH + 3));
    ctx.lineTo(gridLeft + (DIMS * cellW) / 2, outY);
    ctx.stroke();
    ctx.setLineDash([]);

    const maxEma = Math.max(...emaOut.map(Math.abs)) + 0.001;
    for (let d = 0; d < DIMS; d++) {
      const norm = (emaOut[d] + 0.1) / 0.35;
      ctx.fillStyle = rgba(T.teal, 0.3 + norm * 0.6);
      ctx.fillRect(gridLeft + d * cellW, outY, cellW - 1, cellH);
      ctx.strokeStyle = rgba(T.teal, 0.5);
      ctx.lineWidth = 1;
      ctx.strokeRect(gridLeft + d * cellW, outY, cellW - 1, cellH);
    }

    // ── Safe Legend Placement ──
    ctx.fillStyle = T.muted;
    ctx.font = "600 10px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    if (isSmall) {
      const legY = outY + 36;
      ctx.fillText(`α = ${alpha}  |  w(t) = (1−α)·α^(9−t)`, PAD, legY);
      ctx.fillStyle = T.teal;
      ctx.fillText(
        `T9 is ${(weights[9] / weights[0]).toFixed(0)}× T0`,
        PAD,
        legY + 18,
      );
    } else {
      const legX = gridLeft + DIMS * cellW + 14;
      ctx.fillText("EMA weight:", legX, gridTop + 14);
      ctx.fillStyle = T.faint;
      ctx.fillText(`α = ${alpha}`, legX, gridTop + 30);
      ctx.fillText(`w(t) = (1−α)·α^(9−t)`, legX, gridTop + 46);
      ctx.fillText(`T0 → ${weights[0].toFixed(3)}`, legX, gridTop + 68);
      ctx.fillText(`T9 → ${weights[9].toFixed(3)}`, legX, gridTop + 84);
      ctx.fillStyle = T.teal;
      ctx.fillText(
        `T9 is ${(weights[9] / weights[0]).toFixed(0)}× T0`,
        legX,
        gridTop + 100,
      );
    }
  });
})();

// ════════════════════════════════════════════════════════════════════════
// 8. FULL ARCHITECTURE STACK  –  layout perfectly adapts to container bounds
// ════════════════════════════════════════════════════════════════════════
(function () {
  const ch = new CH("stackCanvas", 820);

  const LAYERS = [
    {
      label: "LM Head",
      sub: "Linear → logits [128k]",
      type: "head",
      color: () => T.amber,
    },
    {
      label: "LayerNorm",
      sub: "normalize",
      type: "norm",
      color: () => T.faint,
    },
    {
      label: "EMA Readout",
      sub: "α=0.8 · collapse T→1",
      type: "ema",
      color: () => T.teal,
    },
    {
      label: "Readout LIF",
      sub: "extracts v_membrane",
      type: "lif",
      color: () => T.purple,
    },
    {
      label: "NordBlock ×6",
      sub: "Resonance → FFN → Clamp",
      type: "block",
      color: () => T.blue,
    },
    {
      label: "Input LIF",
      sub: "continuous → spikes",
      type: "lif",
      color: () => T.purple,
    },
    {
      label: "T_slow ×2",
      sub: "scale=5.0  (anchor)",
      type: "slow",
      color: () => T.amber,
    },
    {
      label: "T_fast ×8",
      sub: "scale=15.0 (volatile)",
      type: "fast",
      color: () => T.teal,
    },
    {
      label: "Temporal Proj.",
      sub: "nn.Linear(D,D)",
      type: "proj",
      color: () => T.muted,
    },
    {
      label: "Embedding",
      sub: "vocab 128k → d=512",
      type: "embed",
      color: () => T.green,
    },
    {
      label: "Token",
      sub: '"Hello" → index 9426',
      type: "token",
      color: () => T.coral,
    },
  ];

  const particles = Array.from({ length: 80 }, (_, i) => {
    const isSlow = i % 12 === 0;
    return {
      lane: Math.random(),
      z: Math.random(),
      speed: isSlow ? 0.12 : 0.3 + Math.random() * 0.5,
      color: isSlow ? "amber" : Math.random() < 0.6 ? "teal" : "blue",
      size: isSlow ? 3 : 2,
    };
  });

  anims.push((t) => {
    // Fill with standard panel background, not code
    const ctx = ch.fill(T.panel);
    const W = ch.w,
      H = ch.h;

    const PAD = 20;
    const LBL = Math.max(90, Math.min(220, W * 0.35)); // Dynamic label width
    const pipeLeft = PAD + LBL + 10;
    const pipeW = W - pipeLeft - PAD * 2;
    const nLayers = LAYERS.length;
    const totalH = H - PAD * 2;
    const layerH = totalH / nLayers;

    for (const p of particles) {
      p.z += 0.016 * p.speed * 0.06;
      if (p.z > 1.0) p.z = 0;
    }

    for (let li = 0; li < nLayers; li++) {
      const layer = LAYERS[li],
        yTop = PAD + li * layerH,
        yMid = yTop + layerH / 2,
        col = layer.color(),
        isBlock = layer.type === "block";

      ctx.fillStyle = rgba(col, isBlock ? 0.12 : 0.08); // optimized opacity for generic theme
      ctx.fillRect(pipeLeft, yTop + 1, pipeW, layerH - 2);
      ctx.fillStyle = rgba(col, 0.35);
      ctx.fillRect(pipeLeft, yTop, pipeW, 2);

      ctx.textAlign = "right";
      ctx.fillStyle = col;
      ctx.font = `bold ${Math.max(9, Math.min(13, W / 30))}px IBM Plex Mono, monospace`;
      ctx.fillText(layer.label, PAD + LBL - 5, yMid + 3);
      ctx.fillStyle = T.faint;
      ctx.font = `${Math.max(8, Math.min(11, W / 35))}px IBM Plex Mono, monospace`;
      ctx.fillText(layer.sub, PAD + LBL - 5, yMid + 18);

      ctx.strokeStyle = rgba(col, 0.2);
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(PAD + LBL - 2, yMid);
      ctx.lineTo(pipeLeft, yMid);
      ctx.stroke();
      ctx.setLineDash([]);

      if (isBlock) {
        const subColors = [T.blue, T.blue, T.teal, T.green, T.teal, T.blue];
        for (let s = 0; s < 6; s++) {
          const subY = yTop + (s / 6) * layerH;
          ctx.fillStyle = rgba(subColors[s], 0.12);
          ctx.fillRect(pipeLeft + 2, subY + 1, pipeW - 4, layerH / 6 - 2);
          ctx.fillStyle = rgba(subColors[s], 0.3);
          ctx.fillRect(pipeLeft + 2, subY, pipeW - 4, 1);
        }
      }

      if (layer.type === "lif" && pipeW > 80) {
        ctx.fillStyle = rgba(T.coral, 0.6);
        ctx.font = "600 10px IBM Plex Mono, monospace";
        ctx.textAlign = "right";
        ctx.fillText("97% sparse", pipeLeft + pipeW - 6, yMid + 3);
      }
    }

    for (const p of particles) {
      const px = pipeLeft + 4 + p.lane * (pipeW - 8),
        py = PAD + (1.0 - p.z) * totalH; // Flows Bottom to Top (Input to Output)
      const col =
        p.color === "amber" ? T.amber : p.color === "teal" ? T.teal : T.blue;
      const grd = ctx.createRadialGradient(px, py, 0, px, py, p.size * 3);
      grd.addColorStop(0, rgba(col, 0.5));
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, p.size * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = rgba(T.border2, 0.3);
    ctx.lineWidth = 1;
    ctx.strokeRect(pipeLeft, PAD, pipeW, totalH);

    const legY = H - 18;
    ctx.font = "600 10px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    if (W < 500) {
      ctx.fillStyle = T.teal;
      ctx.fillText("● fast", PAD, legY - 14);
      ctx.fillStyle = T.amber;
      ctx.fillText("● slow", PAD + 60, legY - 14);
      ctx.fillStyle = T.blue;
      ctx.fillText("● deep features", PAD, legY);
    } else {
      ctx.fillStyle = T.teal;
      ctx.fillText("● T_fast activations", PAD, legY);
      ctx.fillStyle = T.amber;
      ctx.fillText("● T_slow activations", PAD + 160, legY);
      ctx.fillStyle = T.blue;
      ctx.fillText("● deep block features", PAD + 320, legY);
    }
  });
})();

// ────────────────────────────────────────────────────────────────────────────
// MAIN ANIMATION LOOP
// ────────────────────────────────────────────────────────────────────────────
function loop(ts) {
  gT = ts * 0.001;
  for (const fn of anims) fn(gT);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
