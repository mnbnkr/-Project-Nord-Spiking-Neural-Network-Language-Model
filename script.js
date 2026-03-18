"use strict";

// ────────────────────────────────────────────────────────────────────────────
// THEME – reads CSS variables dynamically, stays in sync with dark/light mode
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
// CANVAS HELPER – proper DPR, ResizeObserver, no-accumulate transforms
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

function drawPill(ctx, x, y, text, opts = {}) {
  const {
    bg = rgba(T.blue, 0.1),
    border = rgba(T.blue, 0.24),
    fg = T.blue,
    align = "left",
  } = opts;
  ctx.save();
  ctx.font = "700 10px IBM Plex Mono, monospace";
  const padX = 8;
  const h = 22;
  const w = ctx.measureText(text).width + padX * 2;
  const drawX = align === "right" ? x - w : x;
  const r = 11;
  ctx.fillStyle = bg;
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(drawX + r, y);
  ctx.arcTo(drawX + w, y, drawX + w, y + h, r);
  ctx.arcTo(drawX + w, y + h, drawX, y + h, r);
  ctx.arcTo(drawX, y + h, drawX, y, r);
  ctx.arcTo(drawX, y, drawX + w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, drawX + padX, y + h / 2 + 0.5);
  ctx.restore();
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
      embPad = Math.max(20, (W - 350) / 2);
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
    ctx.fillText("x = temporal_proj(embed(token))  ∈ ℝ⁴⁹⁶", W / 2, embY + 22);

    // ── 10 temporal current columns ──
    const nCols = 10;
    const colW = Math.max(12, Math.min(26, (W - 100) / nCols - 8));
    const gap = 8;
    const splitGap = 32; // Visual separation between fast and slow
    const totalW = nCols * colW + 8 * gap + splitGap;
    const startX = (W - totalW) / 2;

    const barBase = embY - 26;
    const maxFastH = barBase - 85;
    const maxSlowH = maxFastH * 0.32; // Exactly 8/25 ratio

    for (let i = 0; i < 10; i++) {
      const isSlow = i >= 8;

      // Calculate isolated horizontal position with dynamic gap
      let x = startX + i * colW + i * gap;
      if (isSlow) x += splitGap - gap;
      const cx = x + colW / 2;

      let barH;
      if (isSlow) {
        barH = maxSlowH * (0.55 + 0.45 * Math.abs(Math.sin(t * 0.4 + i * 1.1)));
      } else {
        const raw = Math.sin(t * (1.2 + i * 0.15) + i * 0.9);
        barH = maxFastH * (0.25 + 0.75 * Math.abs(raw));
      }

      const col = isSlow ? T.amber : T.teal;
      const barY = barBase - barH;

      ctx.strokeStyle = rgba(col, 0.22);
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, embY);
      ctx.lineTo(cx, barBase);
      ctx.stroke();
      ctx.setLineDash([]);

      const grd = ctx.createLinearGradient(x, barY, x, barBase);
      grd.addColorStop(0, rgba(col, 0.9));
      grd.addColorStop(1, rgba(col, 0.35));
      ctx.fillStyle = grd;
      ctx.fillRect(x, barY, colW, barH);

      ctx.fillStyle = rgba(col, 0.95);
      ctx.fillRect(x, barY, colW, 3);

      ctx.fillStyle = T.muted;
      ctx.font = "600 10px IBM Plex Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`T${i + 1}`, cx, barBase + 16);
    }

    // ── Legend ──
    const isSmall = W < 500;
    ctx.font = "bold 12px IBM Plex Mono, monospace";
    if (isSmall) {
      ctx.textAlign = "center";
      ctx.fillStyle = T.teal;
      ctx.fillText("▮▮▮▮▮▮▮▮ T_fast × 8   scale=25", W / 2, 28);
      ctx.fillStyle = T.amber;
      ctx.fillText("▮▮ T_slow × 2   scale=8", W / 2, 46);
    } else {
      ctx.textAlign = "left";
      ctx.fillStyle = T.teal;
      ctx.fillText(
        "▮▮▮▮▮▮▮▮ T_fast × 8   scale = 25.0",
        Math.max(20, startX - 20),
        28,
      );
      ctx.fillStyle = T.amber;
      ctx.fillText(
        "▮▮ T_slow × 2   scale = 8.0",
        Math.max(20, startX - 20),
        48,
      );
    }

    drawPill(
      ctx,
      W - 14,
      14,
      isSmall ? "toy slice" : "toy slice: 1 of 496 dims",
      { align: "right" },
    );

    // ── Left Axis (Fast Amplitude scale=25.0) ──
    const axisX = startX - 14;
    ctx.strokeStyle = rgba(T.text, 0.25);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(axisX + 4, barBase - maxFastH);
    ctx.lineTo(axisX, barBase - maxFastH);
    ctx.lineTo(axisX, barBase);
    ctx.lineTo(axisX + 4, barBase);
    ctx.stroke();

    ctx.fillStyle = rgba(T.text, 0.6);
    ctx.font = "10px IBM Plex Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillText("25.0", axisX - 4, barBase - maxFastH + 4);
    ctx.fillText("0.0", axisX - 4, barBase + 4);

    // ── Right Axis (Slow Amplitude scale=8.0) ──
    const slowRight =
      startX + 9 * colW + 9 * gap + (splitGap - gap) + colW + 14;
    ctx.beginPath();
    ctx.moveTo(slowRight - 4, barBase - maxSlowH);
    ctx.lineTo(slowRight, barBase - maxSlowH);
    ctx.lineTo(slowRight, barBase);
    ctx.lineTo(slowRight - 4, barBase);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillText("8.0", slowRight + 4, barBase - maxSlowH + 4);
  });
})();

// ════════════════════════════════════════════════════════════════════════
// 2. LIF NEURON – bounded clipping, corrected i_syn bounds, spikes on top
// ════════════════════════════════════════════════════════════════════════
(function () {
  const ch = new CH("lifCanvas", 380);

  // Pre-compute accurate LIF simulation matching nord_core.py
  const SIM = 2400;
  const data = [];
  let v = -0.1,
    isyn = 0.0,
    refrac = 0;
  const tau_mem = 0.85,
    tau_syn = 0.5,
    v_thr = 0.12,
    v_rst = -0.1;

  for (let s = 0; s < SIM; s++) {
    const ph = s % 220;

    // Simulate a small sub-threshold cascade bump from a neighbor,
    // followed later by the main driving current burst
    let cur = 0.0;
    if (ph === 15 || ph === 16)
      cur = 0.15; // neighbor cascade injection
    else if (ph > 50 && ph < 140) cur = 0.28; // main driving burst

    if (refrac > 0) {
      // Refractory: clamp to v_reset
      isyn = tau_syn * isyn + cur;
      v = v_rst;
      refrac--;
      data.push({ v, isyn, spike: false, refrac: true, ph });
    } else {
      isyn = tau_syn * isyn + cur;
      const v_new = tau_mem * v + (1.0 - tau_mem) * isyn;
      if (v_new >= v_thr) {
        data.push({ v: v_thr, isyn, spike: true, refrac: false, ph });
        v = v_new - v_thr; // soft reset
        refrac = 2; // 2-timestep refractory
      } else {
        v = v_new;
        data.push({ v, isyn, spike: false, refrac: false, ph });
      }
    }
  }

  anims.push((t) => {
    const ctx = ch.fill(T.panel);
    const W = ch.w,
      H = ch.h;
    const PAD = 14,
      LBL = 80;
    const offset = Math.floor(t * 32) % SIM; // smooth, legible scroll speed

    const plotW = W - LBL - PAD;

    // Custom Track Heights: Spikes track is thinner, analog tracks are taller
    const spkTrackH = 28;
    const remainH = H - PAD * 2 - spkTrackH - 24;
    const trackH = remainH / 2;

    const spkTrackY = PAD;
    const vTrackY = spkTrackY + spkTrackH + 12;
    const iTrackY = vTrackY + trackH + 12;

    // ── Static Left Labels ──
    ctx.font = "600 11px IBM Plex Mono, monospace";
    ctx.textAlign = "right";

    // Pushed labels further left (-12 instead of -8) to avoid intersecting graph lines
    ctx.fillStyle = T.coral;
    ctx.fillText("spikes", LBL - 12, spkTrackY + spkTrackH / 2 + 4);

    ctx.fillStyle = T.teal;
    ctx.fillText("v_mem", LBL - 12, vTrackY + trackH / 2 + 4);

    ctx.fillStyle = T.green;
    ctx.fillText("i_syn", LBL - 12, iTrackY + trackH / 2 + 4);

    function trackY(val, trackTop, th, lo, hi) {
      return trackTop + th - ((val - lo) / (hi - lo)) * th;
    }

    // Widened visual boundaries so the peaks/valleys don't hit the ceiling/floor
    const vLo = -0.25,
      vHi = 0.45;
    const iLo = 0,
      iHi = 0.65;

    const thY = trackY(v_thr, vTrackY, trackH, vLo, vHi);
    const rstY = trackY(v_rst, vTrackY, trackH, vLo, vHi);

    ctx.font = "600 10px IBM Plex Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = rgba(T.coral, 0.9);
    ctx.fillText("thresh 0.12", LBL - 12, thY + 4);
    ctx.fillStyle = T.muted;
    ctx.fillText("reset −0.1", LBL - 12, rstY + 4);

    // Apply Clipping Mask so graph data NEVER touches the left labels
    ctx.save();
    ctx.beginPath();
    ctx.rect(LBL, 0, plotW, H);
    ctx.clip();

    // ── Background & Cascade Markers ──
    let cascadeX = -1;
    for (let px = 0; px < plotW; px++) {
      const d = data[(offset + px) % SIM];

      if (d.refrac) {
        ctx.fillStyle = rgba(T.coral, 0.06);
        ctx.fillRect(LBL + px, vTrackY, 1, trackH);
        ctx.fillRect(LBL + px, iTrackY, 1, trackH);
      }

      // Highlight the sub-threshold cascade injection
      if (d.ph === 15) {
        ctx.fillStyle = rgba(T.amber, 0.3);
        ctx.fillRect(LBL + px, iTrackY, 3, trackH);
        // Grab x-coord to draw the label once per view
        if (cascadeX === -1 && px > 20 && px < plotW - 120) {
          cascadeX = LBL + px;
        }
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

    // ── v_mem trace (Teal) ──
    ctx.beginPath();
    ctx.strokeStyle = T.teal;
    ctx.lineWidth = 2.2;
    for (let px = 0; px < plotW; px++) {
      const d = data[(offset + px) % SIM];
      const y = trackY(d.v, vTrackY, trackH, vLo, vHi);
      px === 0 ? ctx.moveTo(LBL + px, y) : ctx.lineTo(LBL + px, y);
    }
    ctx.stroke();

    // ── i_syn trace (Green) ──
    ctx.beginPath();
    ctx.strokeStyle = T.green;
    ctx.lineWidth = 1.8;
    for (let px = 0; px < plotW; px++) {
      const d = data[(offset + px) % SIM];
      const y = trackY(d.isyn, iTrackY, trackH, iLo, iHi);
      px === 0 ? ctx.moveTo(LBL + px, y) : ctx.lineTo(LBL + px, y);
    }
    ctx.stroke();

    // ── Spike raster (Coral) ──
    for (let px = 0; px < plotW; px++) {
      const d = data[(offset + px) % SIM];
      if (d.spike) {
        ctx.strokeStyle = T.coral;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(LBL + px, spkTrackY + 4);
        ctx.lineTo(LBL + px, spkTrackY + spkTrackH - 4);
        ctx.stroke();
      }
    }

    // ── Cascade Label ──
    if (cascadeX !== -1) {
      ctx.fillStyle = rgba(T.amber, 0.85);
      ctx.font = "600 10px IBM Plex Mono, monospace";
      ctx.textAlign = "left";
      // Shifted down slightly to avoid vertical collision with i_syn peak
      ctx.fillText(
        "↑ neighbor cascade inject",
        cascadeX + 6,
        iTrackY + trackH - 2,
      );
    }

    ctx.restore(); // end clip

    // ── Left Axis Separator ──
    ctx.strokeStyle = rgba(T.border2, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LBL, 0);
    ctx.lineTo(LBL, H);
    ctx.stroke();
  });
})();

// ════════════════════════════════════════════════════════════════════════
// 3. CASCADE RING – Sequential Scatter-Gather (Traveling Particles)
// ════════════════════════════════════════════════════════════════════════
(function () {
  const ch = new CH("casCanvas", 480);
  ch.enableMouse();

  const Nc = 64; // Clusters (Inner Ring)
  const D = 496; // Neurons (Outer Ring)
  const R_W = 3; // Neighbor radius

  const v_mem = new Float32Array(D).fill(0);
  const c_fire = new Float32Array(Nc).fill(0);
  const c_recv = new Float32Array(Nc).fill(0);

  // Visualization view: keep the strongest local couplings readable.
  // The real model uses a sigmoid-bounded soft matrix; this canvas emphasizes
  // the strongest nearby links rather than drawing every soft edge equally.
  const W_mat = Array.from({ length: Nc }, (_, i) =>
    Array.from({ length: Nc }, (_, j) => {
      const dist = Math.min(Math.abs(i - j), Nc - Math.abs(i - j));
      if (dist === 0) return 0.5; // Self-excitation (sigmoid of zero)
      if (dist <= R_W) {
        const init_val = 1.0 - dist / (R_W + 1);
        return 1 / (1 + Math.exp(-init_val)); // Sigmoid approximation
      }
      return 0;
    }),
  );

  let lastFireT = -1;
  let autoFireCooldown = 0;

  // Ripple system to show sequential causality
  const PHASE_IN = 0,
    PHASE_LAT = 1,
    PHASE_OUT = 2;
  const ripples = [];

  anims.push((t) => {
    const ctx = ch.fill(T.panel);
    const W = ch.w,
      H = ch.h;
    const cx = W / 2,
      cy = H / 2 + 15;

    const rIn = Math.min(W, H) * 0.16;
    const rOut = Math.min(W, H) * 0.38;

    // 1. Slow Decay
    for (let i = 0; i < D; i++) v_mem[i] *= 0.96;
    for (let c = 0; c < Nc; c++) {
      c_fire[c] *= 0.92;
      c_recv[c] *= 0.94;
    }

    // 2. Precompute Geometry
    const n_pos = [];
    const c_pos = [];

    for (let c = 0; c < Nc; c++) {
      const a_c = (c / Nc) * Math.PI * 2 - Math.PI / 2;
      c_pos.push({
        x: cx + Math.cos(a_c) * rIn,
        y: cy + Math.sin(a_c) * rIn,
        a: a_c,
      });
    }

    let hovered_n = -1;
    let minDist = 15;

    for (let i = 0; i < D; i++) {
      const c = i % Nc;
      const k = Math.floor(i / Nc); // 0 to 7
      const arc_step = (Math.PI * 2) / Nc / 9;
      const a_n = c_pos[c].a + (k - 3.5) * arc_step;

      const nx = cx + Math.cos(a_n) * rOut;
      const ny = cy + Math.sin(a_n) * rOut;
      n_pos.push({ nx, ny, c, a: a_n });

      if (Math.hypot(ch.mx - nx, ch.my - ny) < minDist) {
        minDist = Math.hypot(ch.mx - nx, ch.my - ny);
        hovered_n = i;
      }
    }

    // 3. Trigger Logic
    function triggerSpike(idx) {
      v_mem[idx] = 1.5;
      // Phase 1: Spawn inward ripple (Scatter) - sped up for better flow
      ripples.push({
        type: PHASE_IN,
        from: idx,
        to: idx % Nc,
        prog: 0,
        speed: 0.035,
        weight: 1.0,
      });
    }

    // Cooldowns adjusted to keep animation active
    if (hovered_n >= 0 && t - lastFireT > 0.4) {
      lastFireT = t;
      triggerSpike(hovered_n);
    }

    autoFireCooldown--;
    if (autoFireCooldown <= 0 && hovered_n === -1 && ripples.length === 0) {
      autoFireCooldown = 60 + Math.random() * 60;
      triggerSpike(Math.floor(Math.random() * D));
    }

    // 4. Process Ripples (Traveling Signal)
    for (let i = ripples.length - 1; i >= 0; i--) {
      let r = ripples[i];
      r.prog += r.speed;

      if (r.prog >= 1.0) {
        if (r.type === PHASE_IN) {
          c_fire[r.to] = 1.0;
          for (let j = 0; j < Nc; j++) {
            if (W_mat[r.to][j] > 0) {
              // Phase 2: Lateral transfer
              ripples.push({
                type: PHASE_LAT,
                from: r.to,
                to: j,
                prog: 0,
                speed: 0.025,
                weight: W_mat[r.to][j] * 1.5,
              });
            }
          }
        } else if (r.type === PHASE_LAT) {
          c_recv[r.to] = Math.max(c_recv[r.to], r.weight);
          for (let n = 0; n < D; n++) {
            if (n % Nc === r.to) {
              // Phase 3: Gather outward
              ripples.push({
                type: PHASE_OUT,
                from: r.to,
                to: n,
                prog: 0,
                speed: 0.035,
                weight: r.weight * 0.4,
              });
            }
          }
        } else if (r.type === PHASE_OUT) {
          v_mem[r.to] = Math.min(v_mem[r.to] + r.weight, 0.95);
        }
        ripples.splice(i, 1);
      }
    }

    // ── DRAWING ──

    // A. Draw Base Faint Web & Spokes
    ctx.strokeStyle = rgba(T.border2, 0.05);
    ctx.lineWidth = 0.5;
    for (let c = 0; c < Nc; c++) {
      for (let offset = 1; offset <= R_W; offset++) {
        const j = (c + offset) % Nc;
        ctx.beginPath();
        ctx.moveTo(c_pos[c].x, c_pos[c].y);
        ctx.lineTo(c_pos[j].x, c_pos[j].y);
        ctx.stroke();
      }
    }
    for (let i = 0; i < D; i++) {
      ctx.beginPath();
      ctx.moveTo(n_pos[i].nx, n_pos[i].ny);
      ctx.lineTo(c_pos[n_pos[i].c].x, c_pos[n_pos[i].c].y);
      ctx.stroke();
    }

    // B. Draw Active Inner Clusters
    for (let c = 0; c < Nc; c++) {
      const isFire = c_fire[c] > 0.1;
      const isRecv = c_recv[c] > 0.1;
      const colorHex = isFire ? T.coral : isRecv ? T.teal : T.border2;

      ctx.fillStyle = colorHex;
      ctx.beginPath();
      ctx.arc(
        c_pos[c].x,
        c_pos[c].y,
        isFire ? 4 : isRecv ? 3 : 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      if (isFire || isRecv) {
        const glowR = isFire ? 18 : 12;
        const alpha = isFire ? c_fire[c] * 0.6 : c_recv[c] * 0.4;
        const grd = ctx.createRadialGradient(
          c_pos[c].x,
          c_pos[c].y,
          0,
          c_pos[c].x,
          c_pos[c].y,
          glowR,
        );
        grd.addColorStop(0, rgba(colorHex, alpha));
        // FIX: Fade to the SAME color with 0 alpha to prevent dark rings
        grd.addColorStop(1, rgba(colorHex, 0));
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(c_pos[c].x, c_pos[c].y, glowR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // C. Draw Outer Neurons
    for (let i = 0; i < D; i++) {
      const v = v_mem[i];
      const isSpike = v >= 1.0;
      const isSub = v > 0.05 && !isSpike;
      const colorHex = isSpike ? T.coral : isSub ? T.teal : T.text;

      ctx.fillStyle = isSpike || isSub ? colorHex : rgba(T.text, 0.15);
      ctx.beginPath();
      ctx.arc(n_pos[i].nx, n_pos[i].ny, isSpike ? 2.5 : 1.2, 0, Math.PI * 2);
      ctx.fill();

      if (isSpike || isSub) {
        const glowR = isSpike ? 14 : 6 + v * 6;
        const alpha = isSpike ? 0.7 : v * 0.5;
        const grd = ctx.createRadialGradient(
          n_pos[i].nx,
          n_pos[i].ny,
          0,
          n_pos[i].nx,
          n_pos[i].ny,
          glowR,
        );
        grd.addColorStop(0, rgba(colorHex, alpha));
        // FIX: Fade to the SAME color with 0 alpha to prevent dark rings
        grd.addColorStop(1, rgba(colorHex, 0));
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(n_pos[i].nx, n_pos[i].ny, glowR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // D. Draw Traveling Ripples
    for (let r of ripples) {
      let rx, ry, col;
      let isPulse = false;

      if (r.type === PHASE_IN) {
        rx = n_pos[r.from].nx + (c_pos[r.to].x - n_pos[r.from].nx) * r.prog;
        ry = n_pos[r.from].ny + (c_pos[r.to].y - n_pos[r.from].ny) * r.prog;
        col = T.coral;
      } else if (r.type === PHASE_LAT) {
        let a1 = c_pos[r.from].a;
        let a2 = c_pos[r.to].a;
        if (r.from !== r.to) {
          if (a2 - a1 > Math.PI) a1 += Math.PI * 2;
          if (a1 - a2 > Math.PI) a2 += Math.PI * 2;
        } else {
          isPulse = true; // Visual self-excitation pulse
        }
        const aCur = a1 + (a2 - a1) * r.prog;
        rx = cx + Math.cos(aCur) * rIn;
        ry = cy + Math.sin(aCur) * rIn;
        col = T.amber;
      } else if (r.type === PHASE_OUT) {
        rx = c_pos[r.from].x + (n_pos[r.to].nx - c_pos[r.from].x) * r.prog;
        ry = c_pos[r.from].y + (n_pos[r.to].ny - c_pos[r.from].y) * r.prog;
        col = T.teal;
      }

      ctx.fillStyle = col;
      ctx.beginPath();

      if (isPulse) {
        // Draw an outward-expanding ring for self-excitation
        const pulseR = 2.0 + Math.sin(r.prog * Math.PI) * 5;
        ctx.arc(rx, ry, pulseR, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Draw standard traveling dot + glow
        ctx.arc(rx, ry, 2.0, 0, Math.PI * 2);
        ctx.fill();

        const grd = ctx.createRadialGradient(rx, ry, 0, rx, ry, 10);
        grd.addColorStop(0, rgba(col, 0.6));
        grd.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(rx, ry, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // E. Labels
    ctx.fillStyle = T.muted;
    ctx.font = "bold 13px IBM Plex Mono, monospace";
    ctx.textAlign = "center";

    ctx.fillText("Scatter-Gather (496 Neurons → 64 Clusters)", cx, 36);
    drawPill(
      ctx,
      W - 14,
      14,
      W < 560 ? "strongest couplings shown" : "strongest local couplings shown",
      { align: "right" },
    );

    ctx.font = "10px IBM Plex Mono, monospace";
    ctx.fillStyle = T.faint;

    if (W < 520) {
      ctx.fillText("Phase 1: Scatter (Coral) | Phase 2: W_mat (Amber)", cx, 54);
      ctx.fillText("Phase 3: Gather (Teal)", cx, 68);
    } else {
      ctx.fillText(
        "Phase 1: Scatter (Coral) | Phase 2: W_mat (Amber) | Phase 3: Gather (Teal)",
        cx,
        54,
      );
    }

    const subThresholdN = v_mem.filter((v) => v > 0.05 && v < 1.0).length;
    const spikingN = v_mem.filter((v) => v >= 1.0).length;
    ctx.fillStyle = T.teal;
    ctx.font = "600 11px IBM Plex Mono, monospace";
    ctx.fillText(
      `activated after ripple: ${subThresholdN} sub-threshold, ${spikingN} spiking`,
      cx,
      H - 16,
    );
  });
})();

// ════════════════════════════════════════════════════════════════════════
// 4. RESONANCE - toy readability view with explicit temporal mixing
// ════════════════════════════════════════════════════════════════════════
(function () {
  const ch = new CH("resCanvas", 470);

  const SEQ = 10,
    T_total = 10,
    TOP_K = 3;
  const qPat = Array.from({ length: SEQ }, () =>
    Array.from({ length: T_total }, () => 0),
  );
  const kPat = Array.from({ length: SEQ }, () =>
    Array.from({ length: T_total }, () => 0),
  );
  const res = Array.from({ length: SEQ }, () =>
    Array.from({ length: SEQ }, () => null),
  );
  const topK = Array.from({ length: SEQ }, () => new Set());
  const mixQ = new Float32Array(T_total).fill(1 / T_total);
  const mixK = new Float32Array(T_total).fill(1 / T_total);

  let lastCycle = -1;

  function normalizeMix(raw, out) {
    let maxVal = -Infinity;
    for (const v of raw) maxVal = Math.max(maxVal, v);
    const exps = raw.map((v) => Math.exp(v - maxVal));
    const denom = exps.reduce((acc, v) => acc + v, 0);
    for (let i = 0; i < exps.length; i++) out[i] = exps[i] / denom;
  }

  anims.push((t) => {
    const ctx = ch.fill(T.panel);
    const W = ch.w,
      H = ch.h;

    const isSmall = W < 560;
    const scale = isSmall ? Math.max(0.62, W / 560) : 1.0;

    const SPIKE_W = 10 * scale;
    const SPIKE_H = 8 * scale;
    const HEAT_CELL = 28 * scale;
    const marginLeft = isSmall ? 48 : 86;
    const marginTop = isSmall ? 116 : 138;
    const heatTop = marginTop;
    const heatLeft = marginLeft + T_total * SPIKE_W + (isSmall ? 18 : 26);
    const qWeightTop = heatTop + SEQ * HEAT_CELL + 8;
    const qWeightH = 18;
    const qWeightBottom = qWeightTop + qWeightH;
    const kSpikeBottom = heatTop - 18;
    const kSpikeTop = kSpikeBottom - T_total * SPIKE_H;
    const kWeightX = heatLeft - 18 * scale - 8;

    const cycle = Math.floor((t * 0.8) / SEQ);
    const scanRow = Math.floor(t * 0.8) % SEQ;

    if (cycle !== lastCycle) {
      lastCycle = cycle;
      const rawQ = Array.from(
        { length: T_total },
        (_, tt) => Math.sin(cycle * 0.45 + tt * 0.8) + 0.3 * Math.cos(tt * 1.4),
      );
      const rawK = Array.from(
        { length: T_total },
        (_, tt) => Math.cos(cycle * 0.35 + tt * 0.65) - 0.25 * Math.sin(tt * 1.2 + 0.5),
      );
      normalizeMix(rawQ, mixQ);
      normalizeMix(rawK, mixK);

      for (let i = 0; i < SEQ; i++) {
        for (let tt = 0; tt < T_total; tt++) {
          qPat[i][tt] = Math.random() < 0.35 ? 1 : 0;
          kPat[i][tt] = Math.random() < 0.35 ? 1 : 0;
        }
      }
      for (let i = 0; i < SEQ; i++) {
        for (let j = 0; j < SEQ; j++) {
          if (j > i) {
            res[i][j] = null;
            continue;
          }
          let score = 0;
          for (let tt = 0; tt < T_total; tt++) {
            score += qPat[i][tt] * kPat[j][tt] * mixQ[tt] * mixK[tt];
          }
          res[i][j] = score;
        }
        const row = res[i]
          .map((v, j) => ({ v, j }))
          .filter((x) => x.v !== null);
        row.sort((a, b) => b.v - a.v);
        topK[i] = new Set(row.slice(0, TOP_K).map((x) => x.j));
      }
    }

    drawPill(
      ctx,
      W - 14,
      14,
      isSmall ? "toy top-3 view" : "toy view: top-3 shown, real K = min(64, S)",
      { align: "right" },
    );

    ctx.fillStyle = T.muted;
    ctx.font = "600 11px IBM Plex Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillText("Q spikes", marginLeft - 6, marginTop - 8);

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
      ctx.fillText(`S${i}`, marginLeft - 6, y + HEAT_CELL / 2 + 4);
    }

    const maxMixQ = Math.max(...mixQ);
    ctx.fillStyle = T.faint;
    ctx.font = "9px IBM Plex Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillText("w_q", marginLeft - 6, qWeightTop + qWeightH / 2 + 3);
    for (let tt = 0; tt < T_total; tt++) {
      const x = marginLeft + tt * SPIKE_W;
      const barH = (mixQ[tt] / maxMixQ) * (qWeightH - 4);
      ctx.fillStyle = rgba(T.blue, 0.12);
      ctx.fillRect(x + 1, qWeightTop, SPIKE_W - 2, qWeightH);
      ctx.fillStyle = rgba(T.blue, 0.72);
      ctx.fillRect(x + 1, qWeightBottom - barH, SPIKE_W - 2, barH);
    }
    ctx.fillStyle = T.faint;
    ctx.font = "10px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      "T=0 → T=9",
      marginLeft + (T_total * SPIKE_W) / 2,
      qWeightBottom + 13,
    );

    ctx.fillStyle = T.muted;
    ctx.font = "600 11px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      "K spikes (past tokens)",
      heatLeft + (SEQ * HEAT_CELL) / 2,
      kSpikeTop - 12,
    );

    const maxMixK = Math.max(...mixK);
    ctx.fillStyle = T.faint;
    ctx.font = "9px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText("w_k", kWeightX + 9 * scale, kSpikeTop - 12);
    for (let tt = 0; tt < T_total; tt++) {
      const y = kSpikeTop + tt * SPIKE_H + 1;
      const barW = (mixK[tt] / maxMixK) * 18 * scale;
      ctx.fillStyle = rgba(T.blue, 0.12);
      ctx.fillRect(kWeightX, y, 18 * scale, SPIKE_H - 1);
      ctx.fillStyle = rgba(T.blue, 0.72);
      ctx.fillRect(kWeightX, y, barW, SPIKE_H - 1);
    }

    for (let j = 0; j < SEQ; j++) {
      const x = heatLeft + j * HEAT_CELL;
      for (let tt = 0; tt < T_total; tt++) {
        if (kPat[j][tt]) {
          ctx.fillStyle = rgba(T.amber, 0.65);
          ctx.fillRect(
            x + 3,
            kSpikeTop + tt * SPIKE_H + 1,
            HEAT_CELL - 6,
            SPIKE_H - 1,
          );
        }
      }
      ctx.fillStyle = T.faint;
      ctx.font = "10px IBM Plex Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`S${j}`, x + HEAT_CELL / 2, heatTop - 6);
    }

    const maxRes = mixQ.reduce((acc, q, tt) => acc + q * mixK[tt], 0);
    for (let i = 0; i < SEQ; i++) {
      for (let j = 0; j < SEQ; j++) {
        const x = heatLeft + j * HEAT_CELL;
        const y = heatTop + i * HEAT_CELL;
        if (j > i) {
          ctx.fillStyle = rgba(T.text, 0.12);
          ctx.fillRect(x, y, HEAT_CELL, HEAT_CELL);
          continue;
        }
        const v = res[i][j];
        const norm = maxRes > 0 ? v / maxRes : 0;
        const isScan = i === scanRow;
        const isTop = topK[i].has(j);
        const isProcessed = i < scanRow;
        let cellColor;
        if (isProcessed) {
          cellColor = isTop
            ? rgba(T.teal, 0.15 + norm * 0.6)
            : rgba(T.text, 0.25);
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
          ctx.fillText(v.toFixed(2), x + HEAT_CELL / 2, y + HEAT_CELL / 2 + 4);
        }
      }
    }

    const scanY = heatTop + scanRow * HEAT_CELL;
    ctx.strokeStyle = rgba(T.coral, 0.7);
    ctx.lineWidth = 2;
    ctx.strokeRect(heatLeft, scanY, SEQ * HEAT_CELL, HEAT_CELL);

    let lx, ly;
    if (isSmall) {
      lx = marginLeft;
      ly = qWeightBottom + 22;
      ctx.textAlign = "center";
      ctx.fillStyle = T.muted;
      ctx.fillText(
        "Resonance matrix (toy temporal mix view)",
        heatLeft + (SEQ * HEAT_CELL) / 2,
        ly - 10,
      );
    } else {
      lx = heatLeft + SEQ * HEAT_CELL + 16;
      ly = marginTop + 12;
      ctx.textAlign = "center";
      ctx.fillStyle = T.muted;
      ctx.fillText(
        "Resonance matrix (toy temporal mix view)",
        heatLeft + (SEQ * HEAT_CELL) / 2,
        H - 12,
      );
    }

    ctx.fillStyle = T.teal;
    ctx.font = "600 10px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText("■ top-3 kept (toy)", lx, ly);
    ctx.fillStyle = rgba(T.coral, 0.8);
    ctx.fillText("■ scanning query", lx, ly + 16);
    ctx.fillStyle = rgba(T.text, 0.25);
    ctx.fillText("■ zeroed after mask", lx, ly + 32);
    ctx.fillStyle = rgba(T.text, 0.12);
    ctx.fillText("■ future (causal)", lx, ly + 48);
    ctx.fillStyle = T.faint;
    ctx.fillText("real code: K = min(64, S)", lx, ly + 70);
    ctx.fillText("RoPE is used in v4, omitted here", lx, ly + 86);
  });
})();

// ========================================================================
// 5. SPIKE-DRIVEN MoE (Association Zone)
// ========================================================================
(function () {
  const ch = new CH("moeCanvas", 420);
  const N_EXPERTS = 4;
  const N_TOKENS = 10;
  const TOP_K = 2;
  const tokens = Array.from({ length: N_TOKENS }, (_, i) => ({
    id: i, experts: [0, 1], weights: [0.6, 0.4],
  }));
  const expertLoad = new Float32Array(N_EXPERTS).fill(0.25);

  anims.push((t) => {
    const ctx = ch.fill(T.panel);
    const W = ch.w, H = ch.h;
    const PAD = 16;
    const expertColors = [T.teal, T.amber, T.purple, T.coral];
    const routerY = 60, expertTop = 110, expertBot = H - 100, mergeY = H - 60;
    const expertW = Math.min(80, (W - PAD * 2 - 60) / N_EXPERTS);
    const totalExpertW = N_EXPERTS * expertW + (N_EXPERTS - 1) * 16;
    const expertStartX = (W - totalExpertW) / 2;

    ctx.fillStyle = T.muted;
    ctx.font = "bold 13px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText("Spike-Driven MoE: 4 Experts, Top-2 Routing", W / 2, 28);

    // Router bar
    ctx.fillStyle = rgba(T.blue, 0.12);
    ctx.fillRect(PAD + 30, routerY - 12, W - PAD * 2 - 60, 24);
    ctx.strokeStyle = rgba(T.blue, 0.4);
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD + 30, routerY - 12, W - PAD * 2 - 60, 24);
    ctx.fillStyle = T.faint;
    ctx.font = "600 10px IBM Plex Mono, monospace";
    ctx.fillText("Spike-Rate Router", W / 2, routerY + 4);

    // Expert columns
    for (let e = 0; e < N_EXPERTS; e++) {
      const ex = expertStartX + e * (expertW + 16);
      const col = expertColors[e];
      ctx.fillStyle = rgba(col, 0.06);
      ctx.fillRect(ex, expertTop, expertW, expertBot - expertTop);
      ctx.strokeStyle = rgba(col, 0.35);
      ctx.lineWidth = 1;
      ctx.strokeRect(ex, expertTop, expertW, expertBot - expertTop);
      const cx = ex + expertW / 2;
      for (let si = 0; si < 6; si++) {
        const sy = expertTop + 15 + si * ((expertBot - expertTop - 30) / 6);
        const fires = Math.sin(t * 1.8 + e * 2.3 + si * 1.1) > 0.6;
        ctx.fillStyle = rgba(col, fires ? 0.8 : 0.12);
        ctx.beginPath();
        ctx.arc(cx, sy, fires ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = col;
      ctx.font = "600 10px IBM Plex Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText("E" + e, cx, expertBot + 14);
      const barW = expertW - 8, barH = 8, barY = expertBot + 20;
      ctx.fillStyle = rgba(col, 0.15);
      ctx.fillRect(ex + 4, barY, barW, barH);
      const load = 0.2 + 0.15 * Math.sin(t * 0.3 + e * 1.5);
      expertLoad[e] += (load - expertLoad[e]) * 0.05;
      ctx.fillStyle = rgba(col, 0.6);
      ctx.fillRect(ex + 4, barY, barW * Math.min(expertLoad[e] * 3, 1), barH);
    }

    // Animated tokens
    for (let ti = 0; ti < N_TOKENS; ti++) {
      const tok = tokens[ti];
      const e0 = Math.floor(Math.abs(Math.sin(t * 0.2 + ti * 1.7)) * N_EXPERTS) % N_EXPERTS;
      let e1 = (e0 + 1 + Math.floor(Math.abs(Math.cos(t * 0.15 + ti * 2.3)) * (N_EXPERTS - 1))) % N_EXPERTS;
      if (e1 === e0) e1 = (e0 + 1) % N_EXPERTS;
      tok.experts = [e0, e1];
      const tokX = PAD + 40 + (ti / (N_TOKENS - 1)) * (W - PAD * 2 - 80);
      const phase = ((t * 0.6 + ti * 0.15) % 3) / 3;
      if (phase < 0.33) {
        const py = routerY + phase * 3 * (expertTop - routerY);
        ctx.fillStyle = rgba(T.text, 0.6);
        ctx.beginPath(); ctx.arc(tokX, py, 3.5, 0, Math.PI * 2); ctx.fill();
      } else if (phase < 0.8) {
        const prog = (phase - 0.33) / 0.47;
        for (let k = 0; k < TOP_K; k++) {
          const ei = tok.experts[k];
          const ex = expertStartX + ei * (expertW + 16) + expertW / 2;
          const ey = expertTop + prog * (expertBot - expertTop);
          ctx.fillStyle = rgba(expertColors[ei], k === 0 ? 0.8 : 0.4);
          ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        const prog = (phase - 0.8) / 0.2;
        const py = expertBot + prog * (mergeY - expertBot);
        ctx.fillStyle = rgba(T.text, 0.5 * (1 - prog));
        ctx.beginPath(); ctx.arc(tokX, py, 3, 0, Math.PI * 2); ctx.fill();
      }
    }

    ctx.fillStyle = rgba(T.green, 0.08);
    ctx.fillRect(PAD + 30, mergeY - 8, W - PAD * 2 - 60, 16);
    ctx.fillStyle = T.faint;
    ctx.font = "10px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText("Weighted Merge", W / 2, mergeY + 4);
  });
})();

// ========================================================================
// 6. MEMORY CORTEX
// ========================================================================
(function () {
  const ch = new CH("memCanvas", 470);
  const M = 128,
    COLS = 16,
    ROWS = 8,
    N_HEADS = 4,
    T_total = 10;
  const memAct = new Float32Array(M).fill(0);
  const headAttn = Array.from({ length: N_HEADS }, () =>
    new Float32Array(T_total).fill(1 / T_total),
  );

  function normalizeMix(raw, out) {
    let maxVal = -Infinity;
    for (const v of raw) maxVal = Math.max(maxVal, v);
    const exps = raw.map((v) => Math.exp(v - maxVal));
    const denom = exps.reduce((acc, v) => acc + v, 0);
    for (let i = 0; i < exps.length; i++) out[i] = exps[i] / denom;
  }

  anims.push((t) => {
    const ctx = ch.fill(T.panel);
    const W = ch.w,
      H = ch.h;
    const hc = [T.teal, T.amber, T.coral, T.purple];
    const isSmall = W < 560;

    const titleY = isSmall ? 22 : 24;
    ctx.fillStyle = T.muted;
    if (isSmall) {
      ctx.font = "bold 12px IBM Plex Mono, monospace";
      ctx.textAlign = "left";
      ctx.fillText("Memory Cortex", 16, titleY);
      ctx.font = "600 10px IBM Plex Mono, monospace";
      ctx.fillStyle = T.faint;
      ctx.fillText("persistent write + gated read", 16, titleY + 16);
    } else {
      ctx.font = "bold 13px IBM Plex Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = T.muted;
      ctx.fillText("Memory Cortex: persistent write, temporal read, gated mix-back", W / 2, titleY);
    }
    drawPill(
      ctx,
      W - 14,
      14,
      isSmall ? "read gate only" : "read gate scales readout only",
      {
        align: "right",
        bg: rgba(T.green, 0.08),
        border: rgba(T.green, 0.24),
        fg: T.green,
      },
    );

    const gridTop = isSmall ? 70 : 54;
    const gridLeft = 92;
    const cellW = Math.min(18, (W - 220) / COLS);
    const cellH = Math.min(18, (H - 270) / ROWS);
    const gridW = COLS * cellW;
    const gridH = ROWS * cellH;
    const writeX = 26;
    const writeW = 24;
    const gateX = gridLeft + gridW + 22;
    const gateW = 24;
    const attnTop = gridTop + gridH + (isSmall ? 30 : 36);
    const attnCellW = Math.min(26, gridW / T_total);
    const attnCellH = 15;
    const mixY = attnTop + N_HEADS * (attnCellH + 6) + (isSmall ? 16 : 20);
    const mixW = Math.min(gridW, W - gridLeft - 40);
    const traceY = mixY + (isSmall ? 38 : 42);
    const traceW = mixW;
    const traceH = H - traceY - 24;

    const writeLevel = 0.2 + 0.75 * Math.max(0, Math.sin(t * 0.7) * 0.5 + 0.5);
    const readGate = 1 / (1 + Math.exp(-(Math.sin(t * 0.5 + 0.9) * 2.3)));

    for (let h = 0; h < N_HEADS; h++) {
      const raw = Array.from(
        { length: T_total },
        (_, tt) =>
          Math.sin(t * (0.45 + h * 0.05) + tt * 0.7 + h * 0.9) +
          0.35 * Math.cos(tt * 1.15 - h * 0.5),
      );
      normalizeMix(raw, headAttn[h]);
    }

    for (let idx = 0; idx < M; idx++) {
      memAct[idx] *= 0.9975;
      const writeHit =
        Math.sin(t * 0.82 + idx * 0.23) + 0.45 * Math.cos(idx * 0.11 - t * 0.35) >
        1.02;
      if (writeHit) memAct[idx] = Math.min(1, memAct[idx] + 0.24 * writeLevel);
    }

    const memMean = memAct.reduce((acc, v) => acc + v, 0) / M;
    const readStrength = readGate * (0.25 + memMean * 0.75);

    ctx.fillStyle = rgba(T.border2, 0.15);
    ctx.fillRect(writeX, gridTop, writeW, gridH);
    const writeFillH = gridH * writeLevel;
    const writeGrd = ctx.createLinearGradient(
      writeX,
      gridTop + gridH - writeFillH,
      writeX,
      gridTop + gridH,
    );
    writeGrd.addColorStop(0, rgba(T.amber, 0.72));
    writeGrd.addColorStop(1, rgba(T.amber, 0.2));
    ctx.fillStyle = writeGrd;
    ctx.fillRect(writeX, gridTop + gridH - writeFillH, writeW, writeFillH);
    ctx.strokeStyle = rgba(T.amber, 0.45);
    ctx.lineWidth = 1;
    ctx.strokeRect(writeX, gridTop, writeW, gridH);
    ctx.fillStyle = T.faint;
    ctx.font = "9px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText("Write", writeX + writeW / 2, gridTop - 6);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c;
        const x = gridLeft + c * cellW;
        const y = gridTop + r * cellH;
        const intensity = memAct[idx];
        const writeGlow = Math.max(
          0,
          Math.sin(t * 0.82 + idx * 0.23) + 0.45 * Math.cos(idx * 0.11 - t * 0.35) - 1.02,
        );
        ctx.fillStyle = rgba(T.teal, 0.05 + intensity * 0.45);
        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
        if (writeGlow > 0) {
          ctx.fillStyle = rgba(T.amber, Math.min(0.16 + writeGlow * 0.35, 0.38));
          ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
        }
      }
    }
    ctx.strokeStyle = rgba(T.border2, 0.3);
    ctx.lineWidth = 1;
    ctx.strokeRect(gridLeft, gridTop, gridW, gridH);

    ctx.fillStyle = rgba(T.border2, 0.15);
    ctx.fillRect(gateX, gridTop, gateW, gridH);
    const gateFillH = gridH * readGate;
    const gateGrd = ctx.createLinearGradient(
      gateX,
      gridTop + gridH - gateFillH,
      gateX,
      gridTop + gridH,
    );
    gateGrd.addColorStop(0, rgba(T.green, 0.72));
    gateGrd.addColorStop(1, rgba(T.green, 0.2));
    ctx.fillStyle = gateGrd;
    ctx.fillRect(gateX, gridTop + gridH - gateFillH, gateW, gateFillH);
    ctx.strokeStyle = rgba(T.green, 0.45);
    ctx.lineWidth = 1;
    ctx.strokeRect(gateX, gridTop, gateW, gridH);
    const threshY = gridTop + gridH * (1 - 0.3);
    ctx.strokeStyle = rgba(T.coral, 0.6);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(gateX - 2, threshY);
    ctx.lineTo(gateX + gateW + 2, threshY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = T.faint;
    ctx.font = "9px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText("Read gate", gateX + gateW / 2, gridTop - 6);
    ctx.fillText("0.3", gateX + gateW + 10, threshY + 3);

    ctx.fillStyle = T.faint;
    ctx.font = "600 10px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText("Temporal read attention over T = 10", gridLeft, attnTop - 10);
    for (let h = 0; h < N_HEADS; h++) {
      const rowY = attnTop + h * (attnCellH + 6);
      ctx.fillStyle = hc[h];
      ctx.fillText(`H${h}`, gridLeft - 26, rowY + attnCellH / 2 + 3);
      for (let tt = 0; tt < T_total; tt++) {
        const x = gridLeft + tt * attnCellW;
        const weight = headAttn[h][tt];
        ctx.fillStyle = rgba(T.border2, 0.15);
        ctx.fillRect(x, rowY, attnCellW - 2, attnCellH);
        ctx.fillStyle = rgba(hc[h], 0.18 + weight * 0.82);
        ctx.fillRect(x, rowY, attnCellW - 2, attnCellH);
      }
    }
    ctx.fillStyle = T.faint;
    ctx.font = "9px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    for (let tt = 0; tt < T_total; tt++) {
      ctx.fillText(`T${tt}`, gridLeft + tt * attnCellW + attnCellW / 2 - 1, attnTop - 22);
    }

    ctx.fillStyle = T.faint;
    ctx.font = "600 10px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText("Gated readout -> from_memory -> mix-back", gridLeft, mixY - 8);
    ctx.fillStyle = rgba(T.border2, 0.15);
    ctx.fillRect(gridLeft, mixY, mixW, 16);
    ctx.fillStyle = rgba(T.green, 0.7);
    ctx.fillRect(gridLeft, mixY, mixW * readStrength, 16);
    ctx.strokeStyle = rgba(T.green, 0.35);
    ctx.lineWidth = 1;
    ctx.strokeRect(gridLeft, mixY, mixW, 16);

    ctx.fillStyle = T.faint;
    ctx.font = "600 10px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText("Persistent decay comparison", gridLeft, traceY - 8);

    ctx.strokeStyle = T.teal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = 0; px < traceW; px++) {
      const retained = Math.pow(0.99, px * 0.08);
      const py = traceY + (1 - retained) * traceH;
      px === 0 ? ctx.moveTo(gridLeft + px, py) : ctx.lineTo(gridLeft + px, py);
    }
    ctx.stroke();

    ctx.strokeStyle = rgba(T.coral, 0.55);
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (let px = 0; px < traceW; px++) {
      const retained = Math.pow(0.85, px * 0.08);
      const py = traceY + (1 - retained) * traceH;
      px === 0 ? ctx.moveTo(gridLeft + px, py) : ctx.lineTo(gridLeft + px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = "10px IBM Plex Mono, monospace";
    ctx.fillStyle = T.teal;
    ctx.fillText("tau = 0.99 (memory)", gridLeft + traceW + 8, traceY + 10);
    ctx.fillStyle = rgba(T.coral, 0.72);
    ctx.fillText("tau = 0.85 (normal)", gridLeft + traceW + 8, traceY + 28);
  });
})();

// ════════════════════════════════════════════════════════════════════════
// 7. STDP – dynamically bounded trace width & safe text alignment
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
  let maxdW = 0.0001;
  for (let i = 0; i < LEN; i++) {
    tp = tp * decay_p + pre[i];
    tm = tm * decay_m + post[i];
    trPre[i] = tp;
    trPost[i] = tm;
    if (post[i]) w += a_plus * tp; // LTP jump
    if (pre[i]) w -= a_minus * tm; // LTD jump
    dW[i] = w;
    if (Math.abs(w) > maxdW) maxdW = Math.abs(w);
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
    const isSmall = W < 560;

    ctx.fillStyle = T.muted;
    ctx.font = `bold ${isSmall ? 11 : 13}px IBM Plex Mono, monospace`;
    ctx.textAlign = "center";
    ctx.fillText(
      isSmall
        ? "STDP engine (inactive in current v4 path)"
        : "Reward-modulated STDP engine (inactive in current v4 path)",
      W / 2,
      20,
    );
    drawPill(
      ctx,
      W - 14,
      10,
      "inactive in current v4 path",
      {
        align: "right",
        bg: rgba(T.coral, 0.08),
        border: rgba(T.coral, 0.24),
        fg: T.coral,
      },
    );

    const offset = Math.floor(t * 28) % LEN;
    const PAD = 40,
      LBL = 90,
      rightPad = 85;
    const plotW = W - LBL - rightPad;
    const nTracks = 4;
    const trackH = (H - PAD * 2 - 24) / nTracks;

    const trackTops = [
      PAD,
      PAD + trackH + 6,
      PAD + (trackH + 6) * 2,
      PAD + (trackH + 6) * 3,
    ];
    const labels = ["spikes", "pre  trace", "post trace", "reward × ΔW"];
    const colors = [T.text, rgba(T.coral, 0.7), rgba(T.teal, 0.8), T.text];

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

    // Track 0: Spikes (separated cleanly into top and bottom half)
    for (let px = 0; px < plotW; px++) {
      if (data_sample(pre, offset, px, LEN) > 0.5) {
        ctx.fillStyle = T.coral;
        ctx.fillRect(LBL + px, trackTops[0] + 4, 2, trackH * 0.4);
      }
      if (data_sample(post, offset, px, LEN) > 0.5) {
        ctx.fillStyle = T.teal;
        ctx.fillRect(
          LBL + px,
          trackTops[0] + trackH * 0.5 + 4,
          2,
          trackH * 0.4,
        );
      }
    }
    // Mini labels inside the track
    ctx.fillStyle = T.coral;
    ctx.font = "9px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText("pre ▼", LBL + 4, trackTops[0] + trackH * 0.35);
    ctx.fillStyle = T.teal;
    ctx.fillText("post ▲", LBL + 4, trackTops[0] + trackH - 4);

    // Traces (Tracks 1 & 2)
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

    // Track 3: reward phase strip + dW step-line graph
    const cy_t = trackTops[3] + trackH / 2;

    // Draw reward phase strip at the bottom
    const rewY = trackTops[3] + trackH - 6;
    for (let px = 0; px < plotW; px++) {
      const i = (offset + px) % LEN;
      const r = reward[i];
      ctx.fillStyle = r > 0.5 ? rgba(T.green, 0.2) : rgba(T.coral, 0.15);
      ctx.fillRect(LBL + px, rewY, 1, 6);
    }

    // Zero line
    ctx.strokeStyle = rgba(T.border2, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LBL, cy_t);
    ctx.lineTo(LBL + plotW, cy_t);
    ctx.stroke();

    // Gradient that colors line Green above center, Coral below center
    const grad = ctx.createLinearGradient(
      0,
      trackTops[3],
      0,
      trackTops[3] + trackH,
    );
    grad.addColorStop(0, T.green);
    grad.addColorStop(0.48, T.green);
    grad.addColorStop(0.52, T.coral);
    grad.addColorStop(1, T.coral);

    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    let prev_i = -1;
    for (let px = 0; px < plotW; px++) {
      const i = (offset + px) % LEN;
      const final_w = dW[i] * (2 * reward[i] - 1); // Reward flips direction
      const y = cy_t - (final_w / maxdW) * (trackH * 0.35);

      if (px === 0 || i < prev_i) {
        if (px > 0) {
          ctx.stroke(); // Draw prior segment before wrap
          ctx.beginPath();
        }
        ctx.moveTo(LBL + px, y);
      } else {
        ctx.lineTo(LBL + px, y);
      }
      prev_i = i;
    }
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
// 8. LEAKY CLAMP – fixed scale radius to mathematically prevent overlap
// ════════════════════════════════════════════════════════════════════════
(function () {
  const ch = new CH("lkyCanvas", 340);

  anims.push((t) => {
    const ctx = ch.fill(T.panel);
    const W = ch.w,
      H = ch.h;

    const PAD = 48;
    const scale = Math.min((H - PAD * 2) * 0.4, W / 10);
    const thirdW = W / 3;
    const cx1 = thirdW * 0.5;
    const cx2 = thirdW * 1.5;
    const cx3 = thirdW * 2.5;
    const baseY = H / 2 + 20;
    const floor = -0.1,
      leak = 0.1;

    // Draw axes for all 3 panels
    for (const cx of [cx1, cx2, cx3]) {
      ctx.strokeStyle = rgba(T.border2, 0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - scale * 1.2, baseY);
      ctx.lineTo(cx + scale * 1.2, baseY);
      ctx.moveTo(cx, baseY + scale * 1.1);
      ctx.lineTo(cx, baseY - scale * 1.1);
      ctx.stroke();
      ctx.fillStyle = T.faint;
      ctx.font = "9px IBM Plex Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText("0", cx + 5, baseY + 12);
      ctx.fillText("x", cx + scale * 1.2, baseY + 12);
      ctx.textAlign = "right";
      ctx.fillText("f(x)", cx - 4, baseY - scale + 10);
    }

    const titleFont = `bold ${Math.max(9, Math.min(12, W / 50))}px IBM Plex Mono, monospace`;

    // Panel 1: Standard ReLU
    ctx.fillStyle = T.muted;
    ctx.font = titleFont;
    ctx.textAlign = "center";
    ctx.fillText("ReLU (standard)", cx1, PAD - 12);

    ctx.strokeStyle = rgba(T.coral, 0.7);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx1 - scale * 1.1, baseY);
    ctx.lineTo(cx1, baseY);
    ctx.lineTo(cx1 + scale, baseY - scale);
    ctx.stroke();

    ctx.fillStyle = rgba(T.coral, 0.8);
    ctx.font = "10px IBM Plex Mono, monospace";
    ctx.fillText("0 (DEAD)", cx1 - scale * 0.5, baseY - 12);

    // Panel 2: LeakyClamp sensory/association (floor=-0.1)
    ctx.fillStyle = T.teal;
    ctx.font = titleFont;
    ctx.fillText("LeakyClamp (sens/assoc)", cx2, PAD - 12);

    const floorY = baseY - floor * scale;
    ctx.strokeStyle = rgba(T.amber, 0.55);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx2 - scale * 1.1, floorY);
    ctx.lineTo(cx2 + scale * 0.1, floorY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = T.amber;
    ctx.font = "9px IBM Plex Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillText("floor = -0.1", cx2 - scale * 0.6, floorY - 4);

    ctx.strokeStyle = T.teal;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const x_val = -1.2 + (i / 200) * 2.4;
      const y_val = x_val >= 0 ? x_val : Math.max(leak * x_val, floor);
      const px = cx2 + x_val * scale,
        py = baseY - y_val * scale;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.fillStyle = rgba(T.teal, 0.6);
    ctx.font = "9px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`leak = ${leak}`, cx2 - scale * 1, baseY + 35);

    // Panel 3: Executive zone (force_nonneg=True -> F.relu)
    ctx.fillStyle = T.coral;
    ctx.font = titleFont;
    ctx.textAlign = "center";
    ctx.fillText("Executive (force_nonneg)", cx3, PAD - 12);

    ctx.strokeStyle = rgba(T.coral, 0.7);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx3 - scale * 1.1, baseY);
    ctx.lineTo(cx3, baseY);
    ctx.lineTo(cx3 + scale, baseY - scale);
    ctx.stroke();

    ctx.fillStyle = rgba(T.coral, 0.6);
    ctx.font = "9px IBM Plex Mono, monospace";
    ctx.fillText("0 (intentional)", cx3 - scale * 0.5, baseY - 12);
    ctx.fillStyle = rgba(T.purple, 0.7);
    ctx.font = "9px IBM Plex Mono, monospace";
    ctx.fillText("clean readout", cx3 + scale * 0.1, baseY + 35);

    // Animated dot across all 3 panels
    const phase = (t % 4.0) / 4.0;
    const x_anim = -1.1 + phase * 2.2;
    for (const [cx_dot, type, dotCol] of [
      [cx1, "relu", T.coral],
      [cx2, "lky", T.teal],
      [cx3, "exec", T.coral],
    ]) {
      const y_anim =
        x_anim >= 0
          ? x_anim
          : type === "lky"
            ? Math.max(leak * x_anim, floor)
            : 0;
      const px = cx_dot + x_anim * scale,
        py = baseY - y_anim * scale;
      const grd = ctx.createRadialGradient(px, py, 2, px, py, 12);
      grd.addColorStop(0, rgba(dotCol, 0.5));
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(px, py, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = dotCol;
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
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
// 9. EMA TEMPORAL READOUT - hybrid readout view
// ════════════════════════════════════════════════════════════════════════
(function () {
  const ch = new CH("emaCanvas", 430);
  const T_total = 10,
    alpha = 0.8,
    DIMS = 16;
  const weights = Array.from(
    { length: T_total },
    (_, t) => (1 - alpha) * Math.pow(alpha, T_total - 1 - t),
  );

  const vMem = Array.from({ length: T_total }, () => new Float32Array(DIMS));
  const emaOut = new Float32Array(DIMS);
  const spikeMean = new Float32Array(DIMS);
  const hybridOut = new Float32Array(DIMS);

  anims.push((t) => {
    const ctx = ch.fill(T.panel);
    const W = ch.w,
      H = ch.h;

    for (let tt = 0; tt < T_total; tt++) {
      for (let d = 0; d < DIMS; d++) {
        vMem[tt][d] =
          0.15 * Math.sin(tt * 0.7 + d * 0.5 + t * 1.8) +
          0.1 * Math.sin(d * 1.1 - t * 0.8) +
          0.05;
      }
    }

    const PAD = 20;
    const isSmall = W < 520;
    const LBL_W = 58;
    const rightMargin = isSmall ? PAD : 150;
    const cellW = Math.max(
      8,
      Math.min(28, (W - PAD - rightMargin - LBL_W) / DIMS),
    );
    const cellH = 20;
    const gridTop = PAD + 18;
    const gridLeft = PAD + LBL_W;
    const emaY = gridTop + T_total * (cellH + 3) + 18;
    const spikeY = emaY + cellH + 10;
    const hybridY = spikeY + cellH + 10;
    const scanT = Math.floor(t * 2.0) % T_total;

    emaOut.fill(0);
    spikeMean.fill(0);
    hybridOut.fill(0);
    for (let tt = 0; tt <= scanT; tt++) {
      for (let d = 0; d < DIMS; d++) {
        emaOut[d] = alpha * emaOut[d] + (1 - alpha) * vMem[tt][d];
        const proxySpike = vMem[tt][d] > 0.11 ? 0.18 : vMem[tt][d] > 0.02 ? 0.06 : 0.0;
        spikeMean[d] += proxySpike / (scanT + 1);
      }
    }
    for (let d = 0; d < DIMS; d++) hybridOut[d] = emaOut[d] + spikeMean[d];

    drawPill(
      ctx,
      W - 14,
      14,
      isSmall ? "hybrid readout" : "hybrid readout: EMA + mean spikes",
      {
        align: "right",
        bg: rgba(T.green, 0.08),
        border: rgba(T.green, 0.24),
        fg: T.green,
      },
    );

    ctx.fillStyle = T.faint;
    ctx.font = "9px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    for (let d = 0; d < DIMS; d++) {
      ctx.fillText(`D${d}`, gridLeft + d * cellW + cellW / 2, gridTop - 6);
    }

    for (let tt = 0; tt < T_total; tt++) {
      const rowY = gridTop + tt * (cellH + 3);
      const isScan = tt === scanT;
      ctx.textAlign = "right";
      ctx.fillStyle = isScan ? T.text : T.muted;
      ctx.font = `${isScan ? "bold " : ""}10px IBM Plex Mono, monospace`;
      ctx.fillText(`T${tt}`, gridLeft - 42, rowY + cellH / 2 + 4);

      const wFrac = weights[tt] / weights[T_total - 1];
      ctx.fillStyle = rgba(T.teal, 0.15 + wFrac * 0.25);
      ctx.fillRect(gridLeft - 40, rowY + 2, 32 * wFrac, cellH - 4);
      ctx.fillStyle = rgba(T.teal, 0.8);
      ctx.font = "8px IBM Plex Mono, monospace";
      ctx.textAlign = "right";
      ctx.fillText(weights[tt].toFixed(3), gridLeft - 4, rowY + cellH / 2 + 4);

      for (let d = 0; d < DIMS; d++) {
        const v = vMem[tt][d];
        const norm = Math.max(0, Math.min(1, (v + 0.2) / 0.5));
        const isProcessed = tt < scanT;
        const cellBg = isScan
          ? rgba(T.coral, 0.15 + norm * 0.45)
          : isProcessed
            ? rgba(T.teal, 0.05 + norm * 0.15)
            : rgba(T.teal, 0.05 + norm * 0.3 * (0.3 + (tt / T_total) * 0.7));

        ctx.fillStyle = cellBg;
        ctx.fillRect(gridLeft + d * cellW, rowY, cellW - 1, cellH);
      }

      if (isScan) {
        ctx.strokeStyle = rgba(T.coral, 0.35);
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        for (let d = 0; d < DIMS; d++) {
          ctx.beginPath();
          ctx.moveTo(gridLeft + d * cellW + cellW / 2, rowY + cellH);
          ctx.lineTo(gridLeft + d * cellW + cellW / 2, hybridY);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
    }

    const rows = [
      {
        label: "EMA(v_mem)",
        y: emaY,
        data: emaOut,
        color: T.teal,
        stroke: rgba(T.teal, 0.5),
        norm: (v) => Math.max(0, Math.min(1, (v + 0.1) / 0.35)),
      },
      {
        label: "mean spikes",
        y: spikeY,
        data: spikeMean,
        color: T.amber,
        stroke: rgba(T.amber, 0.45),
        norm: (v) => Math.max(0, Math.min(1, v / 0.18)),
      },
      {
        label: "EMA + spikes",
        y: hybridY,
        data: hybridOut,
        color: T.green,
        stroke: rgba(T.green, 0.45),
        norm: (v) => Math.max(0, Math.min(1, (v + 0.1) / 0.5)),
      },
    ];

    for (const row of rows) {
      ctx.fillStyle = row.color;
      ctx.font = "bold 11px IBM Plex Mono, monospace";
      ctx.textAlign = "right";
      ctx.fillText(row.label, gridLeft - 4, row.y + cellH / 2 + 4);
      for (let d = 0; d < DIMS; d++) {
        const norm = row.norm(row.data[d]);
        ctx.fillStyle = rgba(row.color, 0.28 + norm * 0.58);
        ctx.fillRect(gridLeft + d * cellW, row.y, cellW - 1, cellH);
        ctx.strokeStyle = row.stroke;
        ctx.lineWidth = 1;
        ctx.strokeRect(gridLeft + d * cellW, row.y, cellW - 1, cellH);
      }
    }

    ctx.fillStyle = T.faint;
    ctx.font = "600 10px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText("+", gridLeft - 18, spikeY - 3);
    ctx.fillText("=", gridLeft - 18, hybridY - 3);

    ctx.fillStyle = T.muted;
    ctx.font = "600 10px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    if (isSmall) {
      const legY = hybridY + 36;
      ctx.fillText(`α = ${alpha}  |  w(t) = (1−α)·α^(9−t)`, PAD, legY);
      ctx.fillStyle = T.green;
      ctx.fillText("final row = EMA(v_mem) + mean(readout_spikes)", PAD, legY + 18);
    } else {
      const legX = gridLeft + DIMS * cellW + 20;
      ctx.fillText("Hybrid readout:", legX, gridTop + 14);
      ctx.fillStyle = T.faint;
      ctx.fillText(`α = ${alpha}`, legX, gridTop + 34);
      ctx.fillText(`w(t) = (1−α)·α^(9−t)`, legX, gridTop + 54);
      ctx.fillText(`T0 → ${weights[0].toFixed(3)}`, legX, gridTop + 80);
      ctx.fillText(`T9 → ${weights[9].toFixed(3)}`, legX, gridTop + 100);
      ctx.fillStyle = T.green;
      ctx.fillText("final = EMA(v_mem) + mean(spikes)", legX, gridTop + 124);
    }
  });
})();

// ════════════════════════════════════════════════════════════════════════
// 10. FULL ARCHITECTURE STACK - active v4 path
// ════════════════════════════════════════════════════════════════════════
(function () {
  const ch = new CH("stackCanvas", 950);

  // Active v4 path: separate Memory Cortex between association and executive
  const LAYERS = [
    {
      id: "token",
      label: "Token",
      sub: '"Hello" -> index 9426',
      subSmall: "idx 9426",
      color: () => T.coral,
      hRatio: 0.05,
    },
    {
      id: "embed",
      label: "Embedding",
      sub: "vocab 128k -> d=496",
      subSmall: "128k -> 496",
      color: () => T.green,
      hRatio: 0.06,
    },
    {
      id: "temporal",
      label: "Temporal Proj.",
      sub: "T_fast x8 + T_slow x2",
      subSmall: "8 fast + 2 slow",
      color: () => T.amber,
      hRatio: 0.08,
    },
    {
      id: "input_lif",
      label: "Input LIF",
      sub: "continuous -> spikes",
      subSmall: "to spikes",
      color: () => T.purple,
      hRatio: 0.07,
    },
    {
      id: "sensory",
      label: "Sensory Zone x2",
      sub: "8-10% spike rate",
      subSmall: "8-10% fire",
      color: () => T.teal,
      hRatio: 0.12,
    },
    {
      id: "association",
      label: "Assoc. Zone x2",
      sub: "top-2 routing over 4 experts",
      subSmall: "top-2 MoE",
      color: () => T.purple,
      hRatio: 0.12,
    },
    {
      id: "memory",
      label: "Memory Cortex",
      sub: "128 persistent memory neurons",
      subSmall: "128 persistent cells",
      color: () => T.blue,
      hRatio: 0.1,
    },
    {
      id: "executive",
      label: "Executive Zone x2",
      sub: "force_nonneg before readout",
      subSmall: "force_nonneg",
      color: () => T.coral,
      hRatio: 0.12,
    },
    {
      id: "readout_lif",
      label: "Readout LIF",
      sub: "v_mem + readout spikes",
      subSmall: "v_mem + spikes",
      color: () => T.purple,
      hRatio: 0.09,
    },
    {
      id: "ema",
      label: "Hybrid Readout",
      sub: "EMA(v_mem) + mean spikes",
      subSmall: "EMA + mean spikes",
      color: () => T.teal,
      hRatio: 0.07,
    },
    {
      id: "norm",
      label: "LayerNorm",
      sub: "normalize",
      subSmall: "normalize",
      color: () => T.faint,
      hRatio: 0.05,
    },
    {
      id: "head",
      label: "LM Head",
      sub: "next-token logits [128k]",
      subSmall: "128k logits",
      color: () => T.amber,
      hRatio: 0.07,
    },
  ];

  // 300 data points tracing through the network
  const particles = Array.from({ length: 300 }, (_, i) => ({
    id: i,
    z: Math.random(),
    speed: 0.08 + Math.random() * 0.06,
    lane: i % 10, // represents the 10 timesteps
    x: 0,
    currentAlpha: 0,
    currentSize: 0,
    color: T.teal,
  }));

  // Initial random scatter prevents visual clumping on frame 1
  particles.forEach((p) => (p.x = 200 + Math.random() * 100));

  anims.push((t) => {
    const ctx = ch.fill(T.panel);
    const W = ch.w,
      H = ch.h;

    const PAD = 20;
    const isSmall = W < 500;
    const LBL = Math.max(90, Math.min(220, W * 0.35));
    const pipeLeft = PAD + LBL + 10;
    const pipeW = W - pipeLeft - PAD * 2;

    // Reserve dedicated space at the bottom specifically for the legend
    const legendSpace = isSmall ? 56 : 34;
    const totalH = H - PAD * 2 - legendSpace;

    // 1. Draw Static Layer Boundaries
    let curY = PAD;
    for (let li = 0; li < LAYERS.length; li++) {
      const layer = LAYERS[li];
      const layerH = totalH * layer.hRatio;
      const yTop = curY;
      const yMid = yTop + layerH / 2;
      const col = layer.color();
      const isZone = ["sensory", "association", "executive"].includes(layer.id);

      ctx.fillStyle = rgba(col, isZone ? 0.06 : 0.03);
      ctx.fillRect(pipeLeft, yTop + 1, pipeW, layerH - 2);
      ctx.fillStyle = rgba(col, 0.25);
      ctx.fillRect(pipeLeft, yTop, pipeW, 2);

      ctx.textAlign = "right";
      ctx.fillStyle = col;
      ctx.font = `bold ${Math.max(9, Math.min(isSmall ? 12 : 13, W / 30))}px IBM Plex Mono, monospace`;
      ctx.fillText(layer.label, PAD + LBL - 5, yMid + 3);
      ctx.fillStyle = T.faint;
      ctx.font = `${Math.max(8, Math.min(isSmall ? 9 : 11, W / 35))}px IBM Plex Mono, monospace`;
      ctx.fillText(isSmall ? layer.subSmall : layer.sub, PAD + LBL - 5, yMid + 18);

      ctx.strokeStyle = rgba(col, 0.2);
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(PAD + LBL - 2, yMid);
      ctx.lineTo(pipeLeft, yMid);
      ctx.stroke();
      ctx.setLineDash([]);

      if (isZone) {
        // Draw sub-block divider within each 2-block zone
        const subY = yTop + layerH / 2;
        ctx.fillStyle = rgba(col, 0.18);
        ctx.fillRect(pipeLeft + 2, subY, pipeW - 4, 1);
      }

      curY += layerH;
    }

    // 2. Animate Data Tensor Representation
    for (const p of particles) {
      p.z += p.speed * 0.012; // Flows top to bottom
      if (p.z > 1.0) {
        p.z -= 1.0;
        p.x = pipeLeft + pipeW / 2 + (Math.random() - 0.5) * 15;
        p.currentAlpha = 0;
      }
      const y = PAD + p.z * totalH;

      // Identify which layer this particle is currently in
      let curLayer = LAYERS[0];
      let layerTop = PAD;
      for (let l of LAYERS) {
        if (y >= layerTop && y <= layerTop + totalH * l.hRatio) {
          curLayer = l;
          break;
        }
        layerTop += totalH * l.hRatio;
      }

      let progress = (y - layerTop) / (totalH * curLayer.hRatio);
      let targetX = p.x;
      let targetAlpha = 0;
      let targetSize = 2;
      let targetColor = T.teal; // Fallback

      const laneSpacing = pipeW / 10;
      const laneX = pipeLeft + p.lane * laneSpacing + laneSpacing / 2;
      const centerSpread =
        pipeLeft + pipeW * 0.1 + ((p.id % 20) / 20) * (pipeW * 0.8);

      const isFast = p.lane < 8; // Differentiates T_fast (0-7) from T_slow (8-9)

      // Defined with strict block scoping {} to prevent identifier shadowing
      switch (curLayer.id) {
        case "token": {
          // [1] Dense pulse
          targetX = pipeLeft + pipeW / 2 + (Math.random() - 0.5) * 15;
          targetAlpha = 0.9;
          targetSize = 2.5;
          targetColor = T.coral;
          break;
        }
        case "embed": {
          // [496] Dense expansion
          targetX = centerSpread;
          targetAlpha = 0.6;
          targetSize = 2.2;
          targetColor = T.faint; // Dense Continuous
          break;
        }
        case "temporal": {
          //[10 x 496] Split into Fast + Slow lanes
          targetX =
            laneX +
            (Math.random() - 0.5) * (laneSpacing * (isFast ? 0.5 : 0.05));
          targetAlpha = isFast ? 0.7 : 0.5;
          targetColor = isFast ? T.teal : T.amber;
          break;
        }
        case "input_lif": {
          // Binary Conversion -> Sparsity starts fading in
          targetX = laneX;
          targetAlpha = 0.7 * (1 - progress);
          targetColor = isFast ? T.teal : T.amber;

          if (progress > 0.6) {
            let isSpike = isFast
              ? Math.sin(p.id * 13.7 + t * 2.2) +
                  Math.cos(p.id * 7.1 + t * 1.6) >
                1.85
              : Math.sin(p.id * 9.3 + t * 0.8) +
                  Math.cos(p.id * 4.2 + t * 0.5) >
                1.95;
            if (isSpike) {
              targetAlpha = 1;
              targetSize = isFast ? 3.0 : 2.0;
              targetColor = T.coral;
            } else {
              targetAlpha = isFast ? 0.04 : 0.08;
              targetSize = 1;
            }
          }
          break;
        }
        case "sensory": {
          // Sensory zone: 8-10% spike rate (sparsest processing)
          let jitterS = isFast
            ? Math.sin(y * 0.1 + p.id) * 2
            : Math.sin(y * 0.05 + p.id) * 0.5;
          targetX = laneX + jitterS;

          let isSpikeS = isFast
            ? Math.sin(p.id * 13.7 + t * 2.2) + Math.cos(p.id * 7.1 + t * 1.6) > 1.88
            : Math.sin(p.id * 9.3 + t * 0.8) + Math.cos(p.id * 4.2 + t * 0.5) > 1.96;

          if (isSpikeS) {
            targetAlpha = 1;
            targetSize = isFast ? 3.2 : 2.3;
            targetColor = T.teal;
          } else {
            targetAlpha = isFast ? 0.03 : 0.06;
            targetSize = 1;
            targetColor = isFast ? T.teal : T.amber;
          }
          break;
        }
        case "association": {
          // Association zone: 10-14% spike rate, MoE routing
          let jitterA = isFast
            ? Math.sin(y * 0.12 + p.id) * 2.5
            : Math.sin(y * 0.06 + p.id) * 0.8;
          targetX = laneX + jitterA;

          let isSpikeA = isFast
            ? Math.sin(p.id * 13.7 + t * 2.2) + Math.cos(p.id * 7.1 + t * 1.6) > 1.82
            : Math.sin(p.id * 9.3 + t * 0.8) + Math.cos(p.id * 4.2 + t * 0.5) > 1.92;

          if (isSpikeA) {
            targetAlpha = 1;
            targetSize = isFast ? 3.5 : 2.5;
            targetColor = T.purple;
          } else {
            targetAlpha = isFast ? 0.04 : 0.07;
            targetSize = 1;
            targetColor = isFast ? T.teal : T.amber;
          }
          break;
        }
        case "memory": {
          // Memory Cortex: persistent state is read back into the main stream
          const memCenter = pipeLeft + pipeW / 2;
          targetX =
            memCenter +
            (p.lane - 4.5) * laneSpacing * 0.28 +
            Math.sin(y * 0.08 + p.id * 0.4) * 6;
          targetAlpha = 0.22 + 0.5 * Math.abs(Math.sin(p.id * 0.7 + t * 1.1));
          targetSize = isFast ? 2.4 : 2.0;
          targetColor = T.blue;
          break;
        }
        case "executive": {
          // Executive zone: 11-26% spike rate, non-negative clamp before readout
          let jitterE = isFast
            ? Math.sin(y * 0.15 + p.id) * 3
            : Math.sin(y * 0.08 + p.id) * 1.0;
          targetX = laneX + jitterE;

          let isSpikeE = isFast
            ? Math.sin(p.id * 13.7 + t * 2.2) + Math.cos(p.id * 7.1 + t * 1.6) > 1.72
            : Math.sin(p.id * 9.3 + t * 0.8) + Math.cos(p.id * 4.2 + t * 0.5) > 1.85;

          if (isSpikeE) {
            targetAlpha = 1;
            targetSize = isFast ? 3.8 : 2.8;
            targetColor = T.coral;
          } else {
            // Executive zone: force_nonneg=True, so silent neurons stay at 0 (not negative)
            targetAlpha = 0;
            targetSize = 1;
            targetColor = isFast ? T.teal : T.amber;
          }
          break;
        }
        case "readout_lif": {
          // Accumulating continuous membrane potentials
          targetX = laneX;
          targetAlpha = isFast
            ? 0.2 + 0.6 * Math.abs(Math.sin(p.id * 12 + t * 2))
            : 0.3 + 0.4 * Math.abs(Math.sin(p.id * 5 + t * 0.5));
          targetSize = isFast ? 2.5 : 2.0;
          targetColor = isFast ? T.teal : T.amber;
          break;
        }
        case "ema": {
          // [496] Hybrid readout: EMA(v_mem) + mean spikes
          targetX = centerSpread;
          targetAlpha = 0.7;
          targetSize = 2;
          targetColor = T.faint; // Dense Continuous
          break;
        }
        case "norm": {
          // [496] Normalization
          targetX = centerSpread;
          targetAlpha = 0.5;
          targetSize = 2;
          targetColor = T.faint; // Dense Continuous
          break;
        }
        case "head": {
          // [128k] Massive expansion to next-token logits
          let expansion = 1 + progress * 2.5;
          let center = pipeLeft + pipeW / 2;
          targetX = center + (centerSpread - center) * expansion;
          targetAlpha = 0.8 * (1 - progress); // fades out to the void
          targetSize = 2 + progress * 2;
          targetColor = T.faint; // Dense Continuous
          break;
        }
      }

      // Smooth interpolations for elegant transitions between layer logic
      p.x += (targetX - p.x) * 0.15;
      p.currentAlpha += (targetAlpha - p.currentAlpha) * 0.2;
      p.currentSize += (targetSize - p.currentSize) * 0.2;
      p.color = targetColor;

      // Draw active particles
      if (p.currentAlpha > 0.01) {
        const px = p.x;
        const py = y;
        const col = p.color;

        if (p.currentAlpha > 0.8) {
          const grd = ctx.createRadialGradient(
            px,
            py,
            0,
            px,
            py,
            p.currentSize * 2.5,
          );
          grd.addColorStop(0, rgba(col, p.currentAlpha * 0.5));
          grd.addColorStop(1, "transparent");
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(px, py, p.currentSize * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = rgba(col, p.currentAlpha);
        ctx.beginPath();
        ctx.arc(px, py, p.currentSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.strokeStyle = rgba(T.border2, 0.3);
    ctx.lineWidth = 1;
    ctx.strokeRect(pipeLeft, PAD, pipeW, totalH);

    // 3. Render updated Legend (now safely pushed away from the LM Head edge)
    const legY = H - 16;
    ctx.font = "600 10px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    if (isSmall) {
      // Mobile wraps the legend into two rows
      ctx.fillStyle = T.teal;
      ctx.fillText("● Fast", PAD, legY - 18);
      ctx.fillStyle = T.amber;
      ctx.fillText("● Slow", PAD + 60, legY - 18);
      ctx.fillStyle = T.blue;
      ctx.fillText("● Memory", PAD + 120, legY - 18);
      ctx.fillStyle = T.coral;
      ctx.fillText("● Spike", PAD, legY);
      ctx.fillStyle = T.faint;
      ctx.fillText("● Dense Continuous", PAD + 70, legY);
    } else {
      ctx.fillStyle = T.teal;
      ctx.fillText("● T_fast", PAD, legY);
      ctx.fillStyle = T.amber;
      ctx.fillText("● T_slow", PAD + 80, legY);
      ctx.fillStyle = T.blue;
      ctx.fillText("● Memory Cortex", PAD + 160, legY);
      ctx.fillStyle = T.coral;
      ctx.fillText("● Sparse Spikes", PAD + 290, legY);
      ctx.fillStyle = T.faint;
      ctx.fillText("● Dense Continuous", PAD + 430, legY);
    }
  });
})();

// ────────────────────────────────────────────────────────────────────────────
// MAIN ANIMATION LOOP (Optimized with IntersectionObserver)
// ────────────────────────────────────────────────────────────────────────────
const canvases = document.querySelectorAll(".vis-wrap canvas");
const visibilityMap = new Map();

// Ambitious Performance: Only compute/draw canvases that are actually on-screen
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        visibilityMap.set(entry.target.id, entry.isIntersecting);
      });
    },
    { rootMargin: "150px" },
  ); // Pre-starts the animation right before scrolling into view

  canvases.forEach((c) => observer.observe(c));
}

function loop(ts) {
  gT = ts * 0.001;

  // Since anims array order perfectly matches DOM canvas order,
  // we can map the visibility state to save massive amounts of CPU/Battery.
  anims.forEach((fn, idx) => {
    const canvasId = canvases[idx]?.id;
    // If not tracked yet, or if visible, run the animation
    if (!visibilityMap.has(canvasId) || visibilityMap.get(canvasId)) {
      fn(gT);
    }
  });

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
