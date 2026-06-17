/**
 * ScrollPop Spin-to-Win Renderer — packages/snippet/src/spin.ts
 *
 * Lazy-loaded by the main snippet when a campaign has kind='spin_wheel'.
 * Attached to the global __sp_spin namespace so the main bundle can call it
 * after the dynamic fetch resolves.
 *
 * Security: all tenant values go through sanitize helpers from the main bundle
 * (passed in via the config object). Never inject raw config values into CSS/HTML.
 *
 * Design: a canvas-based spinning wheel. No external deps.
 */

(function () {
  'use strict';

  interface SpinSlice {
    label: string;
    color: string;
    coupon?: string;
    weight?: number;
  }

  interface SpinConfig {
    slices: SpinSlice[];
    spinDurationMs?: number;
    accentColor?: string;
    textColor?: string;
    backgroundColor?: string;
    headline?: string;
    subheadline?: string;
    ctaText?: string;
    showPoweredBy?: boolean;
  }

  const DEFAULT_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#3b82f6', '#ef4444', '#f97316',
  ];

  function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Validate a CSS color (hex / `transparent` / numeric rgb[a]); else fall back. Mirrors
  // sanitize.ts safeCssColor — spin.ts is a standalone chunk so it can't import it. This is the
  // ONLY barrier between a malicious tenant color and a <style> breakout (stored XSS), so every
  // color interpolated into the shadow <style> MUST go through it.
  function safeCssColor(val: unknown, fallback: string): string {
    if (typeof val !== 'string') return fallback;
    if (/^#[0-9A-Fa-f]{3,8}$/.test(val)) return val;
    if (val === 'transparent') return val;
    if (/^rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(?:,\s*[\d.]+%?\s*)?\)$/.test(val)) return val;
    return fallback;
  }

  function pickWeighted(slices: SpinSlice[]): number {
    const total = slices.reduce((s, sl) => s + (sl.weight ?? 1), 0);
    let r = Math.random() * total;
    for (let i = 0; i < slices.length; i++) {
      r -= (slices[i]!.weight ?? 1);
      if (r < 0) return i;
    }
    return slices.length - 1;
  }

  function drawWheel(canvas: HTMLCanvasElement, slices: SpinSlice[], rotation: number): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.width;
    const cx = size / 2, cy = size / 2, r = size / 2 - 4;
    const arc = (Math.PI * 2) / slices.length;

    ctx.clearRect(0, 0, size, size);

    slices.forEach((sl, i) => {
      const start = rotation + i * arc;
      const end = start + arc;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = sl.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]!;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.min(14, Math.floor(r * 0.14))}px system-ui,sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 3;
      const maxLen = 14;
      const label = sl.label.length > maxLen ? sl.label.slice(0, maxLen - 1) + '…' : sl.label;
      ctx.fillText(label, r - 10, 5);
      ctx.restore();
    });

    // Center circle
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  function render(
    shadow: ShadowRoot,
    cfg: SpinConfig,
    onWin: (slice: SpinSlice) => void,
    onDismiss: () => void,
  ): void {
    const slices = cfg.slices && cfg.slices.length > 0 ? cfg.slices : [
      { label: '10% OFF', color: '#6366f1' },
      { label: '20% OFF', color: '#8b5cf6' },
      { label: 'Free Ship', color: '#ec4899' },
      { label: 'Try Again', color: '#f59e0b' },
      { label: '5% OFF', color: '#10b981' },
      { label: '15% OFF', color: '#3b82f6' },
    ];
    const bg = safeCssColor(cfg.backgroundColor, '#ffffff');
    const accent = safeCssColor(cfg.accentColor, '#6366f1');
    const text = safeCssColor(cfg.textColor, '#111827');
    const spinMs = Math.max(1000, Math.min(8000, cfg.spinDurationMs ?? 4000));

    shadow.innerHTML = `
<style>
:host{all:initial;font-family:system-ui,sans-serif;}
.overlay{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,0.55);animation:sp-fade-in .2s ease;}
.popup{position:fixed;z-index:2147483647;top:50%;left:50%;transform:translate(-50%,-50%);
  background:${bg};border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,0.28);
  padding:28px 32px;max-width:420px;width:calc(100vw - 32px);text-align:center;
  animation:sp-zoom-in .25s cubic-bezier(.34,1.56,.64,1);}
.close-btn{position:absolute;top:12px;right:14px;background:none;border:none;cursor:pointer;
  font-size:18px;color:#9ca3af;padding:4px 8px;border-radius:4px;}
.close-btn:hover{background:rgba(0,0,0,.06);}
h2{font-size:22px;font-weight:700;margin:0 0 6px;color:${text};}
p{font-size:14px;color:#6b7280;margin:0 0 20px;}
.wheel-wrap{position:relative;display:inline-block;margin-bottom:20px;}
.pointer{position:absolute;top:-12px;left:50%;transform:translateX(-50%);
  font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));z-index:2;line-height:1;}
canvas{display:block;border-radius:50%;box-shadow:0 4px 24px rgba(0,0,0,0.18);}
.spin-btn{display:inline-block;background:${accent};color:#fff;border:none;border-radius:8px;
  font-size:15px;font-weight:600;padding:12px 36px;cursor:pointer;transition:opacity .15s;}
.spin-btn:disabled{opacity:.5;cursor:not-allowed;}
.result{margin-top:16px;padding:14px 20px;border-radius:10px;background:rgba(99,102,241,.08);
  border:1px solid rgba(99,102,241,.25);display:none;}
.result-label{font-size:18px;font-weight:700;color:${accent};margin-bottom:4px;}
.result-coupon{font-size:22px;font-weight:800;letter-spacing:0.08em;font-family:monospace;
  color:#111827;margin:4px 0;}
.copy-btn{margin-top:8px;background:none;border:1px solid ${accent};color:${accent};
  border-radius:6px;padding:5px 14px;font-size:12px;cursor:pointer;}
.powered{font-size:10px;color:#d1d5db;margin-top:14px;}
@keyframes sp-fade-in{from{opacity:0}to{opacity:1}}
@keyframes sp-zoom-in{from{opacity:0;transform:translate(-50%,-50%) scale(.85)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
</style>
<div class="overlay" id="sp-overlay"></div>
<div class="popup" role="dialog" aria-modal="true" aria-label="${escHtml(cfg.headline || 'Spin to win!')}">
  <button class="close-btn" id="sp-close" aria-label="Close">✕</button>
  <h2>${escHtml(cfg.headline || 'Spin to Win!')}</h2>
  ${cfg.subheadline ? `<p>${escHtml(cfg.subheadline)}</p>` : '<p>Try your luck for an exclusive discount!</p>'}
  <div class="wheel-wrap">
    <div class="pointer">▼</div>
    <canvas id="sp-wheel" width="260" height="260"></canvas>
  </div><br>
  <button class="spin-btn" id="sp-spin-btn">${escHtml(cfg.ctaText || 'Spin the Wheel!')}</button>
  <div class="result" id="sp-result">
    <div class="result-label" id="sp-result-label"></div>
    <div class="result-coupon" id="sp-result-coupon"></div>
    <button class="copy-btn" id="sp-copy-btn">Copy code</button>
  </div>
  ${cfg.showPoweredBy !== false ? '<p class="powered">Powered by ScrollPop</p>' : ''}
</div>`;

    const canvas = shadow.getElementById('sp-wheel') as HTMLCanvasElement;
    const spinBtn = shadow.getElementById('sp-spin-btn') as HTMLButtonElement;
    const resultEl = shadow.getElementById('sp-result') as HTMLDivElement;
    const resultLabel = shadow.getElementById('sp-result-label') as HTMLDivElement;
    const resultCoupon = shadow.getElementById('sp-result-coupon') as HTMLDivElement;
    const copyBtn = shadow.getElementById('sp-copy-btn') as HTMLButtonElement;
    const closeBtn = shadow.getElementById('sp-close') as HTMLButtonElement;
    const overlay = shadow.getElementById('sp-overlay') as HTMLDivElement;

    let rotation = 0;
    drawWheel(canvas, slices, rotation);

    spinBtn.addEventListener('click', () => {
      spinBtn.disabled = true;
      const winIdx = pickWeighted(slices);
      const arc = (Math.PI * 2) / slices.length;
      // Target rotation: land the pointer (top, −π/2) on the winning slice's center
      const targetAngle = -(winIdx * arc + arc / 2) - Math.PI / 2;
      const fullSpins = 4 + Math.floor(Math.random() * 3); // 4–6 full rotations
      const endRotation = rotation + fullSpins * Math.PI * 2 + ((targetAngle - rotation) % (Math.PI * 2) + Math.PI * 2);
      const start = performance.now();
      const startRot = rotation;

      function ease(t: number): number {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      }

      function frame(now: number) {
        const t = Math.min(1, (now - start) / spinMs);
        rotation = startRot + (endRotation - startRot) * ease(t);
        drawWheel(canvas, slices, rotation);
        if (t < 1) {
          requestAnimationFrame(frame);
        } else {
          rotation = endRotation;
          drawWheel(canvas, slices, rotation);
          const winner = slices[winIdx]!;
          resultLabel.textContent = winner.label;
          if (winner.coupon) {
            resultCoupon.textContent = winner.coupon;
            copyBtn.style.display = 'inline-block';
          } else {
            resultCoupon.textContent = '';
            copyBtn.style.display = 'none';
          }
          resultEl.style.display = 'block';
          onWin(winner);
        }
      }
      requestAnimationFrame(frame);
    });

    copyBtn.addEventListener('click', () => {
      try { navigator.clipboard.writeText(resultCoupon.textContent ?? ''); } catch {}
      copyBtn.textContent = 'Copied!';
    });

    const dismiss = () => onDismiss();
    closeBtn.addEventListener('click', dismiss);
    overlay.addEventListener('click', dismiss);
  }

  (window as any).__sp_spin = { render };
})();
