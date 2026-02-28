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
    ctx.fillText("x = temporal_proj(embed(token))  ∈ ℝ⁵¹²", W / 2, embY + 22);

    // ── 10 temporal current columns ──
    const nCols = 10;
    const colW = Math.max(12, Math.min(26, (W - 100) / nCols - 8));
    const gap = 8;
    const splitGap = 32; // Visual separation between fast and slow
    const totalW = nCols * colW + 8 * gap + splitGap;
    const startX = (W - totalW) / 2;

    const barBase = embY - 26;
    const maxFastH = barBase - 85;
    const maxSlowH = maxFastH * 0.33; // Exactly 5/15 ratio

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

    // ── Left Axis (Fast Amplitude scale=15.0) ──
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
    ctx.fillText("15.0", axisX - 4, barBase - maxFastH + 4);
    ctx.fillText("0.0", axisX - 4, barBase + 4);

    // ── Right Axis (Slow Amplitude scale=5.0) ──
    const slowRight =
      startX + 9 * colW + 9 * gap + (splitGap - gap) + colW + 14;
    ctx.beginPath();
    ctx.moveTo(slowRight - 4, barBase - maxSlowH);
    ctx.lineTo(slowRight, barBase - maxSlowH);
    ctx.lineTo(slowRight, barBase);
    ctx.lineTo(slowRight - 4, barBase);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillText("5.0", slowRight + 4, barBase - maxSlowH + 4);
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
  const tau_mem = 0.9,
    tau_syn = 0.5,
    v_thr = 0.25,
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
    ctx.fillText("thresh 0.25", LBL - 12, thY + 4);
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
  const D = 512; // Neurons (Outer Ring)
  const R_W = 3; // Neighbor radius

  const v_mem = new Float32Array(D).fill(0);
  const c_fire = new Float32Array(Nc).fill(0);
  const c_recv = new Float32Array(Nc).fill(0);

  // Precompute W matrix (learned neighbor weights)
  // Replicates python: init_weights = zeros, dist=0 is 0 -> sigmoid(0)=0.5
  const W_mat = Array.from({ length: Nc }, (_, i) =>
    Array.from({ length: Nc }, (_, j) => {
      const dist = Math.min(Math.abs(i - j), Nc - Math.abs(i - j));
      if (dist === 0) return 0.5; // Self-excitation (sigmoid of zero)
      if (dist <= R_W) {
        const init_val = 1.0 - dist / (R_W + 1);
        return 1 / (1 + Math.exp(-init_val)); // Sigmoid approximation
      }
      return 0; // Assuming outside radius is strictly 0 for visualization
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

    ctx.fillText("Scatter-Gather (512 Neurons → 64 Clusters)", cx, 36);

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

    const activeN = v_mem.filter((v) => v > 0.05).length;
    ctx.fillStyle = T.teal;
    ctx.font = "600 11px IBM Plex Mono, monospace";
    ctx.fillText(
      `saved from death: ${activeN} / 512  (${((activeN / 512) * 100).toFixed(0)}%)`,
      cx,
      H - 16,
    );
  });
})();

// ════════════════════════════════════════════════════════════════════════
// 4. RESONANCE – fully responsive scaling and safe legend placement
// ════════════════════════════════════════════════════════════════════════
(function () {
  const ch = new CH("resCanvas", 440); // Height adapted for clean margins

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

  let lastCycle = -1;

  anims.push((t) => {
    const ctx = ch.fill(T.panel);
    const W = ch.w,
      H = ch.h;

    const isSmall = W < 500;
    const scale = isSmall ? Math.max(0.6, W / 500) : 1.0;

    const SPIKE_W = 10 * scale;
    const SPIKE_H = 8 * scale;
    const HEAT_CELL = 28 * scale;
    const marginLeft = isSmall ? 35 : 70;

    // Guaranteed non-overlapping vertical layout
    const marginTop = isSmall ? 100 : 130;
    const heatTop = marginTop;
    const heatLeft = marginLeft + T_total * SPIKE_W + (isSmall ? 10 : 20);

    // K-spikes grow upwards from a safe baseline above the S0..S9 text
    const kSpikeBottom = heatTop - 18;
    const kSpikeTop = kSpikeBottom - T_total * SPIKE_H;

    const cycle = Math.floor((t * 0.8) / SEQ);
    const scanRow = Math.floor(t * 0.8) % SEQ;

    // Regenerate data dynamically every full sweep cycle
    if (cycle !== lastCycle) {
      lastCycle = cycle;
      for (let i = 0; i < SEQ; i++) {
        for (let tt = 0; tt < T_total; tt++) {
          qPat[i][tt] = Math.random() < 0.35 ? 1 : 0;
          kPat[i][tt] = Math.random() < 0.35 ? 1 : 0;
        }
      }
      for (let i = 0; i < SEQ; i++) {
        for (let j = 0; j < SEQ; j++) {
          if (j > i) res[i][j] = null;
          else
            res[i][j] = qPat[i].reduce(
              (acc, q, tt) => acc + q * kPat[j][tt],
              0,
            );
        }
        const row = res[i]
          .map((v, j) => ({ v, j }))
          .filter((x) => x.v !== null);
        row.sort((a, b) => b.v - a.v);
        topK[i] = new Set(row.slice(0, TOP_K).map((x) => x.j));
      }
    }

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
      kSpikeTop - 8,
    );

    for (let j = 0; j < SEQ; j++) {
      const x = heatLeft + j * HEAT_CELL;
      for (let tt = 0; tt < T_total; tt++) {
        if (kPat[j][tt]) {
          ctx.fillStyle = rgba(T.amber, 0.65);
          // Draw safely downwards towards the baseline
          ctx.fillRect(
            x + 3,
            kSpikeTop + tt * SPIKE_H + 1,
            HEAT_CELL - 6,
            SPIKE_H - 1,
          );
        }
      }
      // Label text placed safely below the spikes, above the heatmap
      ctx.fillStyle = T.faint;
      ctx.font = "10px IBM Plex Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText(`S${j}`, x + HEAT_CELL / 2, heatTop - 6);
    }

    // ── Resonance heatmap ──
    const maxRes = T_total * 0.35;
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
        const norm = v / maxRes;
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
          ctx.fillText(v, x + HEAT_CELL / 2, y + HEAT_CELL / 2 + 4);
        }
      }
    }

    const scanY = heatTop + scanRow * HEAT_CELL;
    ctx.strokeStyle = rgba(T.coral, 0.7);
    ctx.lineWidth = 2;
    ctx.strokeRect(heatLeft, scanY, SEQ * HEAT_CELL, HEAT_CELL);

    // ── Axis labels & Legend ──
    let lx, ly;
    if (isSmall) {
      lx = marginLeft;
      ly = heatTop + SEQ * HEAT_CELL + 24;
      ctx.textAlign = "center";
      ctx.fillStyle = T.muted;
      // Placed safely above the legend list
      ctx.fillText(
        "Resonance matrix",
        heatLeft + (SEQ * HEAT_CELL) / 2,
        ly - 8,
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

    ctx.fillStyle = rgba(T.text, 0.25);
    ctx.fillText("■ zeroed (masked)", lx, ly + 32);

    ctx.fillStyle = rgba(T.text, 0.12);
    ctx.fillText("■ future (causal)", lx, ly + 48);

    ctx.fillStyle = T.faint;
    ctx.fillText(`top-K = ${TOP_K}`, lx, ly + 70);
  });
})();

// ════════════════════════════════════════════════════════════════════════
// 5. STDP – dynamically bounded trace width & safe text alignment
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

    const offset = Math.floor(t * 28) % LEN;
    const PAD = 14,
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
// 6. LEAKY CLAMP – fixed scale radius to mathematically prevent overlap
// ════════════════════════════════════════════════════════════════════════
(function () {
  const ch = new CH("lkyCanvas", 340);

  anims.push((t) => {
    const ctx = ch.fill(T.panel);
    const W = ch.w,
      H = ch.h;

    const PAD = 48;
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
      // Added numerical axis markers for immediate clarity
      ctx.fillText("−1", cx - scale, baseY + 13);
      ctx.fillText("+1", cx + scale, baseY + 13);
      ctx.fillText("x", cx + scale * 1.3, baseY + 13);
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
// 7. EMA TEMPORAL READOUT – fully responsive to prevent squeezed cells
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

  const vMem = Array.from({ length: T_total }, () => new Float32Array(DIMS));
  const emaOut = new Float32Array(DIMS);

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
    const isSmall = W < 500;
    const LBL_W = 45;
    const rightMargin = isSmall ? PAD : 140;
    const cellW = Math.max(
      8,
      Math.min(28, (W - PAD - rightMargin - LBL_W) / DIMS),
    );
    const cellH = 22,
      gridTop = PAD + 16,
      gridLeft = PAD + LBL_W;
    const outY = gridTop + T_total * (cellH + 3) + 14;

    const scanT = Math.floor(t * 2.0) % T_total; // Moving temporal scanner

    // Recalculate EMA output dynamically UP TO scanT to visualize accumulation
    emaOut.fill(0);
    for (let tt = 0; tt <= scanT; tt++) {
      for (let d = 0; d < DIMS; d++) {
        emaOut[d] = alpha * emaOut[d] + (1 - alpha) * vMem[tt][d];
      }
    }

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
        const v = vMem[tt][d];
        const norm = Math.max(0, Math.min(1, (v + 0.2) / 0.5));

        // Rows below scanT have been processed and are slightly dimmed out
        const isProcessed = tt < scanT;
        const cellBg = isScan
          ? rgba(T.coral, 0.15 + norm * 0.45)
          : isProcessed
            ? rgba(T.teal, 0.05 + norm * 0.15) // Dimmer history
            : rgba(T.teal, 0.05 + norm * 0.35 * (0.3 + (tt / T_total) * 0.7)); // Future steps

        ctx.fillStyle = cellBg;
        ctx.fillRect(gridLeft + d * cellW, rowY, cellW - 1, cellH);
      }

      // Draw falling dashed lines from the currently scanned row
      if (isScan) {
        ctx.strokeStyle = rgba(T.coral, 0.4);
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        for (let d = 0; d < DIMS; d++) {
          ctx.beginPath();
          ctx.moveTo(gridLeft + d * cellW + cellW / 2, rowY + cellH);
          ctx.lineTo(gridLeft + d * cellW + cellW / 2, outY);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
    }

    ctx.fillStyle = T.teal;
    ctx.font = "bold 11px IBM Plex Mono, monospace";
    ctx.textAlign = "right";
    ctx.fillText("EMA out", gridLeft - 2, outY + cellH / 2 + 4);

    for (let d = 0; d < DIMS; d++) {
      // The EMA effectively builds up dynamically, so the bottom row starts pale and brightens visibly!
      const norm = Math.max(0, Math.min(1, (emaOut[d] + 0.1) / 0.35));
      ctx.fillStyle = rgba(T.teal, 0.3 + norm * 0.6);
      ctx.fillRect(gridLeft + d * cellW, outY, cellW - 1, cellH);
      ctx.strokeStyle = rgba(T.teal, 0.5);
      ctx.lineWidth = 1;
      ctx.strokeRect(gridLeft + d * cellW, outY, cellW - 1, cellH);
    }

    // ── Safe & Spaced Legend Placement ──
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
      const legX = gridLeft + DIMS * cellW + 20; // Increased left padding
      ctx.fillText("EMA weight:", legX, gridTop + 14);
      ctx.fillStyle = T.faint;
      ctx.fillText(`α = ${alpha}`, legX, gridTop + 34);
      ctx.fillText(`w(t) = (1−α)·α^(9−t)`, legX, gridTop + 54);
      ctx.fillText(`T0 → ${weights[0].toFixed(3)}`, legX, gridTop + 80);
      ctx.fillText(`T9 → ${weights[9].toFixed(3)}`, legX, gridTop + 100);
      ctx.fillStyle = T.teal;
      ctx.fillText(
        `T9 is ${(weights[9] / weights[0]).toFixed(0)}× T0`,
        legX,
        gridTop + 120, // Increased vertical spacing
      );
    }
  });
})();

// ════════════════════════════════════════════════════════════════════════
// 8. FULL ARCHITECTURE STACK – layout perfectly adapts to container bounds
// ════════════════════════════════════════════════════════════════════════
(function () {
  const ch = new CH("stackCanvas", 820);

  // Flipped Top-to-Bottom order with accurate proportions
  const LAYERS = [
    {
      id: "token",
      label: "Token",
      sub: '"Hello" → index 9426',
      color: () => T.coral,
      hRatio: 0.07,
    },
    {
      id: "embed",
      label: "Embedding",
      sub: "vocab 128k → d=512",
      color: () => T.green,
      hRatio: 0.07,
    },
    {
      id: "temporal",
      label: "Temporal Proj.",
      sub: "T_fast ×8 + T_slow ×2",
      color: () => T.amber,
      hRatio: 0.1,
    },
    {
      id: "input_lif",
      label: "Input LIF",
      sub: "continuous → spikes",
      color: () => T.purple,
      hRatio: 0.1,
    },
    {
      id: "blocks",
      label: "NordBlock ×6",
      sub: "97% sparse spikes",
      color: () => T.blue,
      hRatio: 0.36,
    },
    {
      id: "readout_lif",
      label: "Readout LIF",
      sub: "extracts v_membrane",
      color: () => T.purple,
      hRatio: 0.1,
    },
    {
      id: "ema",
      label: "EMA Readout",
      sub: "collapse T→1",
      color: () => T.teal,
      hRatio: 0.07,
    },
    {
      id: "norm",
      label: "LayerNorm",
      sub: "normalize",
      color: () => T.faint,
      hRatio: 0.05,
    },
    {
      id: "head",
      label: "LM Head",
      sub: "Linear → logits [128k]",
      color: () => T.amber,
      hRatio: 0.08,
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
    const LBL = Math.max(90, Math.min(220, W * 0.35));
    const pipeLeft = PAD + LBL + 10;
    const pipeW = W - pipeLeft - PAD * 2;

    // Reserve dedicated space at the bottom specifically for the legend (prevents overlap)
    const legendSpace = W < 500 ? 45 : 30;
    const totalH = H - PAD * 2 - legendSpace;

    // 1. Draw Static Layer Boundaries
    let curY = PAD;
    for (let li = 0; li < LAYERS.length; li++) {
      const layer = LAYERS[li];
      const layerH = totalH * layer.hRatio;
      const yTop = curY;
      const yMid = yTop + layerH / 2;
      const col = layer.color();
      const isBlock = layer.id === "blocks";

      ctx.fillStyle = rgba(col, isBlock ? 0.06 : 0.03);
      ctx.fillRect(pipeLeft, yTop + 1, pipeW, layerH - 2);
      ctx.fillStyle = rgba(col, 0.25);
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
        for (let s = 1; s < 6; s++) {
          const subY = yTop + (s / 6) * layerH;
          ctx.fillStyle = rgba(subColors[s], 0.15);
          ctx.fillRect(pipeLeft + 2, subY, pipeW - 4, 1);
        }
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
          // [512] Dense expansion
          targetX = centerSpread;
          targetAlpha = 0.6;
          targetSize = 2.2;
          targetColor = T.faint; // Dense Continuous
          break;
        }
        case "temporal": {
          //[10 x 512] Split into Fast + Slow lanes
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
        case "blocks": {
          //[10 x 512] 97% Sparse Spikes
          let jitter = isFast
            ? Math.sin(y * 0.1 + p.id) * 2
            : Math.sin(y * 0.05 + p.id) * 0.5;
          targetX = laneX + jitter;

          let isSpike = isFast
            ? Math.sin(p.id * 13.7 + t * 2.2) + Math.cos(p.id * 7.1 + t * 1.6) >
              1.85
            : Math.sin(p.id * 9.3 + t * 0.8) + Math.cos(p.id * 4.2 + t * 0.5) >
              1.95;

          if (isSpike) {
            targetAlpha = 1;
            targetSize = isFast ? 3.5 : 2.5;
            targetColor = T.coral; // Sparse Spike
          } else {
            targetAlpha = isFast ? 0.03 : 0.06;
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
          // [512] Collapse 10 temporal lanes back to 1
          targetX = centerSpread;
          targetAlpha = 0.7;
          targetSize = 2;
          targetColor = T.faint; // Dense Continuous
          break;
        }
        case "norm": {
          // [512] Normalization
          targetX = centerSpread;
          targetAlpha = 0.5;
          targetSize = 2;
          targetColor = T.faint; // Dense Continuous
          break;
        }
        case "head": {
          //[128k] Massive expansion to logits vocab
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
    if (W < 500) {
      // Mobile wraps the legend into two rows
      ctx.fillStyle = T.teal;
      ctx.fillText("● Fast", PAD, legY - 18);
      ctx.fillStyle = T.amber;
      ctx.fillText("● Slow", PAD + 60, legY - 18);
      ctx.fillStyle = T.coral;
      ctx.fillText("● Spike", PAD + 120, legY - 18);
      ctx.fillStyle = T.faint;
      ctx.fillText("● Dense Continuous", PAD, legY);
    } else {
      ctx.fillStyle = T.teal;
      ctx.fillText("● T_fast", PAD, legY);
      ctx.fillStyle = T.amber;
      ctx.fillText("● T_slow", PAD + 80, legY);
      ctx.fillStyle = T.coral;
      ctx.fillText("● Sparse Spikes", PAD + 160, legY);
      ctx.fillStyle = T.faint;
      ctx.fillText("● Dense Continuous", PAD + 290, legY);
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
