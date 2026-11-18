import React, { useEffect, useRef } from 'react';

interface SceneLoveHeartProps {
  onInteract: () => void;
  showTapHint?: boolean;
}

export const SceneLoveHeart: React.FC<SceneLoveHeartProps> = ({
  onInteract,
  showTapHint = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onInteractRef = useRef(onInteract);
  onInteractRef.current = onInteract;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
    let rafId = 0;

    // 96 "I love you" items cascading along the tilted parametric heart ribbon
    const itemCount = 96;
    const heartTilt = -0.2; // slight counter-clockwise heart tilt matching reference video
    const textTilt = -0.49; // ~ -28deg constant diagonal angle of "I love you"

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      const minDim = Math.min(width, height);
      const heartScale = minDim * 0.0225;
      const fontSize = Math.max(12, Math.min(30, minDim * 0.036));
      const swayAmp = minDim * 0.018;

      const cx = width * 0.5;
      const cy = height * 0.51;

      ctx.font = `500 ${fontSize}px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const cosH = Math.cos(heartTilt);
      const sinH = Math.sin(heartTilt);

      for (let i = 0; i < itemCount; i++) {
        // Continuous flow along the heart perimeter (fall animation)
        const stagger = i / itemCount;
        const t = stagger * Math.PI * 2 + elapsed * 0.42;

        // Classic parametric heart curve
        const rawX = 16 * Math.pow(Math.sin(t), 3);
        const rawY = -(
          13 * Math.cos(t) -
          5 * Math.cos(2 * t) -
          2 * Math.cos(3 * t) -
          Math.cos(4 * t)
        );

        // Gentle staggered wave sway matching .heart__item sway animation
        const swayPhase = elapsed * 2.2 - i * 0.28;
        const swayOffsetX = Math.sin(swayPhase) * swayAmp;
        const swayOffsetY = Math.cos(swayPhase * 0.85) * (swayAmp * 0.45);

        // Apply slight counter-clockwise tilt to the heart shape
        const rx = rawX * cosH - rawY * sinH;
        const ry = rawX * sinH + rawY * cosH;

        const px = cx + rx * heartScale + swayOffsetX;
        const py = cy + (ry + 1.2) * heartScale + swayOffsetY;

        // Subtle brightness wave along the cascading ribbon
        const pulse = 0.78 + 0.22 * Math.sin(elapsed * 2.4 + i * 0.25);

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(textTilt);
        ctx.shadowColor = `rgba(234, 128, 176, ${0.72 * pulse})`;
        ctx.shadowBlur = Math.max(6, fontSize * 0.48);
        ctx.fillStyle = `rgba(246, 168, 202, ${0.76 + 0.24 * pulse})`;
        ctx.fillText('I love you', 0, 0);
        ctx.restore();
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
      onPointerDown={() => onInteractRef.current()}
      onPointerUp={() => onInteractRef.current()}
      onClick={() => onInteractRef.current()}
      className="relative w-full h-full bg-black overflow-hidden select-none cursor-pointer"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {showTapHint && (
        <div className="absolute bottom-7 left-0 right-0 flex justify-center pointer-events-none">
          <span className="text-[11px] sm:text-xs tracking-[0.26em] uppercase text-[#f6a8ca]/75 animate-pulse-hint font-medium">
            TAP ANYWHERE FOR MUSIC
          </span>
        </div>
      )}
    </div>
  );
};
