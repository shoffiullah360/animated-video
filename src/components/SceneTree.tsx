import React, { useEffect, useRef } from 'react';

interface BranchSpec {
  id: number;
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  w0: number;
  w1: number;
  startTime: number;
  duration: number;
}

interface Blossom {
  nx: number; // normalized offset from heart center (-1..1)
  ny: number;
  size: number;
  rotation: number;
  colorTop: string;
  colorBottom: string;
  delay: number;
  swayPhase: number;
  swayAmp: number;
  zOrder: number;
}

interface FloatingPetal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  rotSpeed: number;
  alpha: number;
  color: string;
  phase: number;
}

// Deterministic seeded PRNG so blossoms match harmoniously every run
function createRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const BLOSSOM_PALETTE: Array<[string, string]> = [
  ['#ff9eb8', '#e6396b'], // vibrant rose
  ['#ffb3c6', '#ff4d7d'], // coral rose
  ['#ffc8b8', '#ff6e7f'], // warm blush coral
  ['#ffe19c', '#ff9f5a'], // sunlit apricot gold
  ['#ffd6a5', '#ff7b7b'], // peach rose
  ['#ff85a8', '#cf2458'], // deep berry pink
  ['#ffe5ec', '#ff8fab'], // soft sakura pink
];

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// Draw a plump mini heart at (0, 0) with radial shading
function drawMiniHeart(
  ctx: CanvasRenderingContext2D,
  size: number,
  colorTop: string,
  colorBottom: string
) {
  const s = size * 0.5;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.85);
  ctx.bezierCurveTo(-s * 0.25, s * 0.65, -s * 1.15, s * 0.15, -s * 1.05, -s * 0.45);
  ctx.bezierCurveTo(-s * 0.98, -s * 0.95, -s * 0.35, -s * 1.05, 0, -s * 0.52);
  ctx.bezierCurveTo(s * 0.35, -s * 1.05, s * 0.98, -s * 0.95, s * 1.05, -s * 0.45);
  ctx.bezierCurveTo(s * 1.15, s * 0.15, s * 0.25, s * 0.65, 0, s * 0.85);
  ctx.closePath();

  const grad = ctx.createRadialGradient(-s * 0.32, -s * 0.38, s * 0.1, 0, 0, s * 1.25);
  grad.addColorStop(0, colorTop);
  grad.addColorStop(1, colorBottom);
  ctx.fillStyle = grad;
  ctx.fill();
}

// Evaluate quadratic Bezier point & draw partial curve up to progress p (0..1)
function drawPartialBranch(
  ctx: CanvasRenderingContext2D,
  b: BranchSpec,
  p: number,
  scaleX: number,
  scaleY: number,
  offsetX: number,
  offsetY: number
) {
  if (p <= 0) return;
  const steps = Math.max(8, Math.floor(24 * p));

  const getPt = (t: number) => {
    const mt = 1 - t;
    return {
      x: offsetX + (mt * mt * b.x0 + 2 * mt * t * b.cx + t * t * b.x1) * scaleX,
      y: offsetY + (mt * mt * b.y0 + 2 * mt * t * b.cy + t * t * b.y1) * scaleY,
    };
  };

  // Draw tapered polygon along the curve for smooth organic wood silhouette
  const leftPts: Array<{ x: number; y: number }> = [];
  const rightPts: Array<{ x: number; y: number }> = [];

  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * p;
    const pt = getPt(t);
    const nextPt = getPt(Math.min(1, t + 0.01));
    const prevPt = getPt(Math.max(0, t - 0.01));

    const dx = nextPt.x - prevPt.x;
    const dy = nextPt.y - prevPt.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    const halfW = ((b.w0 + (b.w1 - b.w0) * t) * Math.min(scaleX, scaleY)) / 2;
    leftPts.push({ x: pt.x + nx * halfW, y: pt.y + ny * halfW });
    rightPts.push({ x: pt.x - nx * halfW, y: pt.y - ny * halfW });
  }

  ctx.beginPath();
  ctx.moveTo(leftPts[0].x, leftPts[0].y);
  for (let i = 1; i < leftPts.length; i++) {
    ctx.lineTo(leftPts[i].x, leftPts[i].y);
  }
  for (let i = rightPts.length - 1; i >= 0; i--) {
    ctx.lineTo(rightPts[i].x, rightPts[i].y);
  }
  ctx.closePath();

  const grad = ctx.createLinearGradient(
    offsetX + b.x0 * scaleX,
    offsetY + b.y0 * scaleY,
    offsetX + b.x1 * scaleX,
    offsetY + b.y1 * scaleY
  );
  grad.addColorStop(0, '#3a1f18');
  grad.addColorStop(1, '#543026');
  ctx.fillStyle = grad;
  ctx.fill();
}

export const SceneTree: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rng = createRng(20261118);

    // Build normalized branch skeleton matching the exact organic fork in the reference video
    // Coordinate space: tree root at (0, 0), top of canopy around (0, -1), width roughly (-0.6..0.6)
    const branches: BranchSpec[] = [
      // Main trunk rising from bottom
      { id: 1, x0: 0, y0: 0.04, cx: 0.015, cy: -0.18, x1: 0.01, y1: -0.36, w0: 0.048, w1: 0.028, startTime: 0.0, duration: 0.75 },
      // Left primary fork
      { id: 2, x0: 0.01, y0: -0.34, cx: -0.11, cy: -0.46, x1: -0.24, y1: -0.58, w0: 0.025, w1: 0.013, startTime: 0.55, duration: 0.65 },
      // Center upright shoot
      { id: 3, x0: 0.01, y0: -0.35, cx: 0.025, cy: -0.49, x1: 0.01, y1: -0.64, w0: 0.02, w1: 0.009, startTime: 0.62, duration: 0.62 },
      // Right primary fork
      { id: 4, x0: 0.01, y0: -0.34, cx: 0.14, cy: -0.45, x1: 0.27, y1: -0.56, w0: 0.025, w1: 0.013, startTime: 0.58, duration: 0.65 },
      // Left secondary branches reaching into left lobe
      { id: 5, x0: -0.13, y0: -0.48, cx: -0.27, cy: -0.52, x1: -0.38, y1: -0.64, w0: 0.014, w1: 0.006, startTime: 0.95, duration: 0.55 },
      { id: 6, x0: -0.21, y0: -0.55, cx: -0.25, cy: -0.67, x1: -0.21, y1: -0.78, w0: 0.012, w1: 0.005, startTime: 1.05, duration: 0.5 },
      { id: 7, x0: -0.24, y0: -0.58, cx: -0.34, cy: -0.68, x1: -0.34, y1: -0.77, w0: 0.01, w1: 0.004, startTime: 1.15, duration: 0.48 },
      { id: 8, x0: -0.1, y0: -0.46, cx: -0.1, cy: -0.61, x1: -0.09, y1: -0.73, w0: 0.012, w1: 0.005, startTime: 1.02, duration: 0.52 },
      // Center twigs
      { id: 9, x0: 0.015, y0: -0.51, cx: -0.04, cy: -0.6, x1: -0.07, y1: -0.68, w0: 0.01, w1: 0.004, startTime: 1.05, duration: 0.45 },
      { id: 10, x0: 0.015, y0: -0.51, cx: 0.07, cy: -0.6, x1: 0.1, y1: -0.69, w0: 0.01, w1: 0.004, startTime: 1.08, duration: 0.45 },
      // Right secondary branches reaching into right lobe
      { id: 11, x0: 0.14, y0: -0.45, cx: 0.28, cy: -0.5, x1: 0.39, y1: -0.61, w0: 0.014, w1: 0.006, startTime: 0.98, duration: 0.55 },
      { id: 12, x0: 0.23, y0: -0.53, cx: 0.24, cy: -0.66, x1: 0.2, y1: -0.79, w0: 0.012, w1: 0.005, startTime: 1.08, duration: 0.5 },
      { id: 13, x0: 0.27, y0: -0.56, cx: 0.34, cy: -0.66, x1: 0.33, y1: -0.76, w0: 0.01, w1: 0.004, startTime: 1.18, duration: 0.48 },
      { id: 14, x0: 0.12, y0: -0.43, cx: 0.14, cy: -0.58, x1: 0.13, y1: -0.72, w0: 0.011, w1: 0.005, startTime: 1.04, duration: 0.5 },
    ];

    // Generate 440 heart-shaped canopy blossoms filling a lush heart silhouette
    const blossoms: Blossom[] = [];
    const totalBlossoms = 440;

    for (let i = 0; i < totalBlossoms; i++) {
      const t = rng() * Math.PI * 2;
      // Parametric heart curve (normalized roughly to [-1, 1])
      const rawX = 16 * Math.pow(Math.sin(t), 3);
      const rawY = -(
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t)
      );

      // Bias outer ring + rich interior coverage so upper lobes and edges look full
      const isEdge = i < 145;
      const radial = isEdge ? 0.84 + rng() * 0.17 : Math.pow(rng(), 0.52) * 0.9;

      const nx = (rawX / 17.2) * radial + (rng() - 0.5) * 0.055;
      const ny = ((rawY - 1.5) / 17.2) * radial + (rng() - 0.5) * 0.055;

      const palette = BLOSSOM_PALETTE[Math.floor(rng() * BLOSSOM_PALETTE.length)];
      // Bloom organically upward from the lower heart fork (ny ~ +0.8 down at the tip, -0.8 at top)
      const upwardWave = (0.75 - ny) * 0.85 + Math.abs(nx) * 0.45;

      blossoms.push({
        nx,
        ny,
        size: 12 + rng() * 14,
        rotation: (rng() - 0.5) * 0.85,
        colorTop: palette[0],
        colorBottom: palette[1],
        delay: 1.3 + upwardWave * 1.45 + rng() * 0.95,
        swayPhase: rng() * Math.PI * 2,
        swayAmp: 0.04 + rng() * 0.06,
        zOrder: rng(),
      });
    }

    blossoms.sort((a, b) => a.zOrder - b.zOrder);

    // Floating drifting petals across the breeze
    const floatingPetals: FloatingPetal[] = Array.from({ length: 22 }, (_, i) => {
      const pal = BLOSSOM_PALETTE[i % BLOSSOM_PALETTE.length];
      return {
        x: rng(),
        y: rng(),
        vx: -0.025 - rng() * 0.035,
        vy: 0.012 + rng() * 0.025,
        size: 6 + rng() * 6.5,
        rotation: rng() * Math.PI * 2,
        rotSpeed: (rng() - 0.5) * 1.6,
        alpha: 0.35 + rng() * 0.45,
        color: pal[1],
        phase: rng() * Math.PI * 2,
      };
    });

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const startTime = performance.now();
    let lastFrameTime = startTime;
    let rafId = 0;

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const isNarrow = width < 640;
      const treeHeight = isNarrow ? height * 0.68 : height * 0.88;
      const treeScale = Math.min(treeHeight, isNarrow ? width * 0.95 : width * 0.62);
      const treeBaseX = isNarrow ? width * 0.54 : width * 0.68;
      const treeBaseY = height;

      // Subtle warm glow behind the blooming canopy
      const canopyCenterX = treeBaseX + 0.01 * treeScale;
      const canopyCenterY = treeBaseY - 0.64 * treeScale;

      if (elapsed > 0.2) {
        const glowAlpha = Math.min(0.42, 0.16 + elapsed * 0.08);
        const halo = ctx.createRadialGradient(
          canopyCenterX,
          canopyCenterY + treeScale * 0.08,
          treeScale * 0.04,
          canopyCenterX,
          canopyCenterY + treeScale * 0.08,
          treeScale * 0.52
        );
        halo.addColorStop(0, `rgba(255, 224, 156, ${glowAlpha})`);
        halo.addColorStop(0.55, `rgba(255, 172, 138, ${glowAlpha * 0.45})`);
        halo.addColorStop(1, 'rgba(255, 172, 138, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(canopyCenterX, canopyCenterY + treeScale * 0.08, treeScale * 0.52, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw growing tree trunk & branches
      for (const b of branches) {
        const rawP = Math.max(0, Math.min(1, (elapsed - b.startTime) / b.duration));
        if (rawP > 0) {
          drawPartialBranch(
            ctx,
            b,
            easeOutCubic(rawP),
            treeScale,
            treeScale,
            treeBaseX,
            treeBaseY
          );
        }
      }

      // Draw heart-shaped canopy blossoms
      const canopyRadius = treeScale * 0.34;
      const blossomScaleFactor = Math.max(0.65, Math.min(1.22, treeScale / 500));

      for (const bl of blossoms) {
        if (elapsed < bl.delay) continue;
        const p = Math.min(1, (elapsed - bl.delay) / 0.55);
        const popScale = p < 1 ? easeOutBack(p) : 1;

        const swayX = Math.sin(elapsed * 1.4 + bl.swayPhase) * 2.4;
        const swayY = Math.cos(elapsed * 1.1 + bl.swayPhase) * 1.6;
        const swayRot = Math.sin(elapsed * 1.2 + bl.swayPhase) * bl.swayAmp;

        const bx = canopyCenterX + bl.nx * canopyRadius + swayX;
        const by = canopyCenterY + bl.ny * canopyRadius + swayY;

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(bl.rotation + swayRot);
        ctx.scale(popScale, popScale);
        drawMiniHeart(ctx, bl.size * blossomScaleFactor, bl.colorTop, bl.colorBottom);
        ctx.restore();
      }

      // Update & draw gentle drifting petals
      if (elapsed > 1.8) {
        const petalFade = Math.min(1, (elapsed - 1.8) / 1.5);
        for (const pt of floatingPetals) {
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt + Math.sin(elapsed * 1.8 + pt.phase) * 0.004 * dt;
          pt.rotation += pt.rotSpeed * dt;

          if (pt.x < -0.05) pt.x = 1.05;
          if (pt.y > 1.05) {
            pt.y = -0.05;
            pt.x = 0.35 + rng() * 0.7;
          }

          ctx.save();
          ctx.globalAlpha = pt.alpha * petalFade;
          ctx.translate(pt.x * width, pt.y * height);
          ctx.rotate(pt.rotation);
          drawMiniHeart(ctx, pt.size * blossomScaleFactor, '#ffb3c6', pt.color);
          ctx.restore();
        }
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      style={{
        background: `
          radial-gradient(ellipse 48% 52% at 26% 24%, rgba(255, 250, 232, 0.94) 0%, transparent 66%),
          radial-gradient(ellipse 56% 64% at 68% 72%, rgba(255, 240, 200, 0.88) 0%, transparent 66%),
          radial-gradient(ellipse 46% 44% at 88% 18%, rgba(255, 222, 160, 0.42) 0%, transparent 65%),
          linear-gradient(145deg, #fde3ba 0%, #fbd0a0 52%, #f6bc8d 100%)
        `,
        boxShadow: 'inset 0 0 120px rgba(180, 92, 42, 0.16)',
      }}
    >
      {/* Full-bleed Canvas for Tree & Heart Canopy */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Left-Side Birthday Message Reveal */}
      <div className="relative z-10 h-full w-full pointer-events-none flex flex-col justify-end sm:justify-end px-6 sm:px-12 md:px-16 pb-10 sm:pb-16 md:pb-20">
        <div className="max-w-md sm:max-w-lg">
          <p
            className="font-serif-display italic text-[#4c2820] opacity-0 animate-fade-slide-up"
            style={{
              fontSize: 'clamp(0.95rem, 1.5vw, 1.25rem)',
              animationDelay: '750ms',
            }}
          >
            and... make it count
          </p>

          <h2
            className="font-script text-[#9b1b32] leading-[1.08] my-1 sm:my-1.5 opacity-0 animate-ink-wipe"
            style={{
              fontSize: 'clamp(2.65rem, 5.4vw, 4.7rem)',
              animationDelay: '1350ms',
              textShadow: '0 2px 12px rgba(255, 255, 255, 0.45)',
            }}
          >
            Happy Birthday
          </h2>

          <p
            className="font-serif-display italic text-[#6d463a] opacity-0 animate-fade-slide-up"
            style={{
              fontSize: 'clamp(0.85rem, 1.25vw, 1.05rem)',
              animationDelay: '2600ms',
            }}
          >
            here&rsquo;s to a year that blooms
          </p>
        </div>
      </div>
    </div>
  );
};
