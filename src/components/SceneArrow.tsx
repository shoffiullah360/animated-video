import React, { useEffect, useRef, useState, useCallback } from 'react';

interface SceneArrowProps {
  onFirstInteract: () => void;
  onComplete: () => void;
  autoPlay?: boolean;
}

interface Point {
  x: number;
  y: number;
}

export const SceneArrow: React.FC<SceneArrowProps> = ({
  onFirstInteract,
  onComplete,
  autoPlay = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1200, height: 720 });

  // Bow aiming & pull state
  const [isDragging, setIsDragging] = useState(false);
  const [pullAmount, setPullAmount] = useState(0); // 0..1
  const [bowAngle, setBowAngle] = useState(-0.48);

  // Arrow flight & hit state
  const [arrowPhase, setArrowPhase] = useState<'nocked' | 'flying' | 'stuck' | 'resetting'>('nocked');
  const [arrowPos, setArrowPos] = useState<Point>({ x: 0, y: 0 });
  const [arrowAngle, setArrowAngle] = useState(-0.48);
  const [heartSquish, setHeartSquish] = useState(false);
  const [expandWave, setExpandWave] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);

  // Refs to prevent stale closures and avoid cancelling active animations on state updates
  const dragStartRef = useRef<Point | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timeoutsRef = useRef<number[]>([]);
  const arrowPhaseRef = useRef<'nocked' | 'flying' | 'stuck' | 'resetting'>('nocked');
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onFirstInteractRef = useRef(onFirstInteract);

  onCompleteRef.current = onComplete;
  onFirstInteractRef.current = onFirstInteract;

  // Responsive coordinates for bow & heart matching video composition
  const bowPos: Point = {
    x: size.width * (size.width < 640 ? 0.24 : 0.27),
    y: size.height * (size.width < 640 ? 0.78 : 0.77),
  };

  const heartPos: Point = {
    x: size.width * (size.width < 640 ? 0.58 : 0.6),
    y: size.height * (size.width < 640 ? 0.39 : 0.42),
  };

  const heartRadius = Math.max(46, Math.min(82, Math.min(size.width, size.height) * 0.11));
  const angleToHeart = Math.atan2(heartPos.y - bowPos.y, heartPos.x - bowPos.x);

  const layoutRef = useRef({ bowPos, heartPos, heartRadius, angleToHeart, size });
  layoutRef.current = { bowPos, heartPos, heartRadius, angleToHeart, size };

  const addSafeTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep idle bow aimed gently toward the heart
  useEffect(() => {
    if (!isDragging && arrowPhase === 'nocked' && !autoPlay) {
      setBowAngle(angleToHeart);
      setArrowAngle(angleToHeart);
    }
  }, [angleToHeart, isDragging, arrowPhase, autoPlay]);

  const ensureAudioUnlocked = useCallback(() => {
    onFirstInteractRef.current();
  }, []);

  const triggerHeartImpact = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    arrowPhaseRef.current = 'stuck';
    setArrowPhase('stuck');
    setHeartSquish(true);
    setPullAmount(0);

    addSafeTimeout(() => {
      setExpandWave(true);
    }, 320);

    addSafeTimeout(() => {
      onCompleteRef.current();
    }, 960);
  }, [addSafeTimeout]);

  // Stable fireArrow using layoutRef so React re-renders never cancel the flight animation
  const fireArrow = useCallback(
    (launchAngle: number, power: number) => {
      if (arrowPhaseRef.current !== 'nocked' || completedRef.current) return;

      const {
        bowPos: bPos,
        heartPos: hPos,
        heartRadius: hRad,
        angleToHeart: targetAngle,
        size: curSize,
      } = layoutRef.current;

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }

      setHintVisible(false);
      arrowPhaseRef.current = 'flying';
      setArrowPhase('flying');
      // Release the bowstring immediately as arrow launches
      setPullAmount(0);

      // Generous magnetic aim assist when aimed broadly toward the heart
      let diff = launchAngle - targetAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      const willHitHeart = Math.abs(diff) < 1.05;
      const assistedAngle = willHitHeart ? targetAngle + diff * 0.1 : launchAngle;

      const startX = bPos.x + Math.cos(assistedAngle) * 18;
      const startY = bPos.y + Math.sin(assistedAngle) * 18;

      setArrowPos({ x: startX, y: startY });
      setArrowAngle(assistedAngle);

      const speed = 1350 + power * 650;
      const vx = Math.cos(assistedAngle) * speed;
      let vy = Math.sin(assistedAngle) * speed;
      const gravity = 320;

      const distToHeart = Math.hypot(hPos.x - startX, hPos.y - startY);
      const targetDuration = Math.max(0.26, Math.min(0.42, distToHeart / 1900));

      let pos = { x: startX, y: startY };
      let lastTime = performance.now();
      let elapsed = 0;

      const step = (now: number) => {
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;
        elapsed += dt;

        if (willHitHeart) {
          const t = Math.min(1, elapsed / targetDuration);
          const arcLift = Math.sin(t * Math.PI) * -18;
          const targetX = hPos.x - Math.cos(targetAngle) * (hRad * 0.12);
          const targetY = hPos.y - Math.sin(targetAngle) * (hRad * 0.12);

          const curX = startX + (targetX - startX) * t;
          const curY = startY + (targetY - startY) * t + arcLift;
          const prevT = Math.max(0, t - 0.02);
          const prevX = startX + (targetX - startX) * prevT;
          const prevY =
            startY + (targetY - startY) * prevT + Math.sin(prevT * Math.PI) * -18;

          setArrowPos({ x: curX, y: curY });
          setArrowAngle(Math.atan2(curY - prevY, curX - prevX));

          if (t >= 1) {
            setArrowPos({ x: targetX, y: targetY });
            triggerHeartImpact();
            return;
          }
        } else {
          pos = { x: pos.x + vx * dt, y: pos.y + vy * dt };
          vy += gravity * dt;
          setArrowPos(pos);
          setArrowAngle(Math.atan2(vy, vx));

          const hitDist = Math.hypot(pos.x - hPos.x, pos.y - hPos.y);
          if (hitDist <= hRad * 0.9) {
            triggerHeartImpact();
            return;
          }

          if (
            pos.x < -120 ||
            pos.x > curSize.width + 120 ||
            pos.y < -120 ||
            pos.y > curSize.height + 120
          ) {
            arrowPhaseRef.current = 'resetting';
            setArrowPhase('resetting');
            setPullAmount(0);
            addSafeTimeout(() => {
              arrowPhaseRef.current = 'nocked';
              setArrowPhase('nocked');
              setHintVisible(true);
            }, 220);
            return;
          }
        }

        animFrameRef.current = requestAnimationFrame(step);
      };

      animFrameRef.current = requestAnimationFrame(step);

      // Guaranteed fallback if tab rAF is throttled
      if (willHitHeart) {
        addSafeTimeout(() => {
          if (!completedRef.current) {
            const targetX = hPos.x - Math.cos(targetAngle) * (hRad * 0.12);
            const targetY = hPos.y - Math.sin(targetAngle) * (hRad * 0.12);
            setArrowPos({ x: targetX, y: targetY });
            triggerHeartImpact();
          }
        }, Math.ceil(targetDuration * 1000) + 120);
      }
    },
    [addSafeTimeout, triggerHeartImpact]
  );

  // Choreographed Auto-Play sequence matching the video timing (0:00 - 0:02.2)
  useEffect(() => {
    if (!autoPlay) return;

    let cancelled = false;
    const startDelay = window.setTimeout(() => {
      if (cancelled || arrowPhaseRef.current !== 'nocked') return;
      const drawStart = performance.now();
      const drawDuration = 760;

      const animateDraw = (now: number) => {
        if (cancelled || arrowPhaseRef.current !== 'nocked') return;
        const p = Math.min(1, (now - drawStart) / drawDuration);
        const eased = 1 - Math.pow(1 - p, 2.2);
        const aimAngle = layoutRef.current.angleToHeart;
        setPullAmount(eased * 0.88);
        setBowAngle(aimAngle);
        setArrowAngle(aimAngle);

        if (p < 1) {
          animFrameRef.current = requestAnimationFrame(animateDraw);
        } else {
          fireArrow(aimAngle, 0.9);
        }
      };

      animFrameRef.current = requestAnimationFrame(animateDraw);
    }, 320);

    return () => {
      cancelled = true;
      window.clearTimeout(startDelay);
    };
  }, [autoPlay, fireArrow]);

  // Global cleanup on unmount only
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      for (const id of timeoutsRef.current) {
        window.clearTimeout(id);
      }
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (arrowPhaseRef.current !== 'nocked' || completedRef.current || autoPlay) return;
    if ((e.target as HTMLElement).closest('button')) return;

    ensureAudioUnlocked();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setPullAmount(0.14);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current || arrowPhaseRef.current !== 'nocked') return;

    const dx = dragStartRef.current.x - e.clientX;
    const dy = dragStartRef.current.y - e.clientY;
    const dist = Math.hypot(dx, dy);

    const maxPullPx = 140;
    const normalizedPull = Math.min(1, Math.max(0.1, dist / maxPullPx));
    setPullAmount(normalizedPull);

    if (dist > 10) {
      const aimAngle = Math.atan2(dy, dx);
      setBowAngle(aimAngle);
      setArrowAngle(aimAngle);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    // Call audio unlock on pointerup/touchend as well for iOS Safari / mobile browsers
    ensureAudioUnlocked();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture already released
    }
    setIsDragging(false);

    const dx = dragStartRef.current.x - e.clientX;
    const dy = dragStartRef.current.y - e.clientY;
    const dist = Math.hypot(dx, dy);
    dragStartRef.current = null;

    if (dist < 16) {
      // Quick tap/click: smooth elastic draw & release directly at the heart
      const drawStart = performance.now();
      const quickDraw = (now: number) => {
        if (arrowPhaseRef.current !== 'nocked' || completedRef.current) return;
        const p = Math.min(1, (now - drawStart) / 260);
        const aimAngle = layoutRef.current.angleToHeart;
        setPullAmount(p * 0.85);
        setBowAngle(aimAngle);
        setArrowAngle(aimAngle);
        if (p < 1) {
          animFrameRef.current = requestAnimationFrame(quickDraw);
        } else {
          fireArrow(aimAngle, 0.88);
        }
      };
      animFrameRef.current = requestAnimationFrame(quickDraw);
    } else if (pullAmount >= 0.16) {
      fireArrow(bowAngle, pullAmount);
    } else {
      setPullAmount(0);
    }
  };

  const stringPullPx = pullAmount * 38;
  const bowScale = Math.max(0.85, Math.min(1.15, Math.min(size.width, size.height) / 680));

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative w-full h-full overflow-hidden cursor-crosshair select-none"
      style={{
        background: `
          radial-gradient(ellipse 52% 48% at 24% 24%, rgba(255, 224, 162, 0.42) 0%, transparent 68%),
          radial-gradient(ellipse 60% 55% at 62% 30%, rgba(255, 178, 146, 0.44) 0%, transparent 70%),
          radial-gradient(ellipse 46% 42% at ${Math.round((heartPos.x / size.width) * 100)}% ${Math.round((heartPos.y / size.height) * 100)}%, rgba(255, 92, 126, 0.24) 0%, transparent 68%),
          radial-gradient(ellipse 55% 48% at 22% 82%, rgba(255, 206, 152, 0.48) 0%, transparent 72%),
          linear-gradient(155deg, #fff6e8 0%, #fde5ca 52%, #f9cfa9 100%)
        `,
        boxShadow: 'inset 0 0 110px rgba(190, 108, 52, 0.14)',
      }}
    >
      {/* Top Caption */}
      <div
        className="absolute left-0 right-0 flex justify-center pointer-events-none transition-opacity duration-500"
        style={{
          top: Math.max(24, heartPos.y - heartRadius * 2.05),
          opacity: expandWave ? 0 : 1,
        }}
      >
        <p
          className="font-serif-display italic text-[#4a231c] tracking-wide text-center px-4"
          style={{
            fontSize: 'clamp(1.05rem, 2.2vw, 1.55rem)',
            textShadow: '0 1px 10px rgba(255,255,255,0.6)',
          }}
        >
          a little something, for you
        </p>
      </div>

      {/* Heart Ambient Glow Aura */}
      <div
        className="absolute pointer-events-none rounded-full transition-transform duration-300"
        style={{
          left: heartPos.x,
          top: heartPos.y,
          width: heartRadius * 4.4,
          height: heartRadius * 4.4,
          transform: `translate(-50%, -50%) scale(${heartSquish ? 1.18 : 1})`,
          background:
            'radial-gradient(circle, rgba(255, 76, 118, 0.36) 0%, rgba(255, 115, 145, 0.16) 45%, transparent 72%)',
          filter: 'blur(8px)',
        }}
      />

      {/* Glossy 3D Pink Heart */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: heartPos.x,
          top: heartPos.y,
          width: heartRadius * 2.15,
          height: heartRadius * 2.15,
          transform: `translate(-50%, -50%) scale(${heartSquish ? '1.14, 0.84' : '1, 1'})`,
          transition: 'transform 210ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Impact sparkles popping above heart (matching reference frame) */}
        {heartSquish && (
          <div className="absolute inset-0 pointer-events-none">
            {[
              { sx: '-36px', sy: '-78px', color: '#ff5c8a', size: 8, delay: '0ms' },
              { sx: '10px', sy: '-92px', color: '#ffd166', size: 7, delay: '40ms' },
              { sx: '42px', sy: '-74px', color: '#ff8fab', size: 6, delay: '20ms' },
              { sx: '-18px', sy: '-64px', color: '#ffc971', size: 6, delay: '60ms' },
              { sx: '28px', sy: '-58px', color: '#ff4775', size: 7, delay: '50ms' },
            ].map((sp, i) => (
              <span
                key={i}
                className="absolute left-1/2 top-1/4 rounded-full animate-sparkle-pop"
                style={
                  {
                    width: sp.size,
                    height: sp.size,
                    backgroundColor: sp.color,
                    animationDelay: sp.delay,
                    '--sx': sp.sx,
                    '--sy': sp.sy,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        )}

        <div className="w-full h-full animate-heartbeat">
          <svg
            viewBox="0 0 200 190"
            className="w-full h-full overflow-visible"
            style={{
              filter: 'drop-shadow(0 16px 26px rgba(224, 30, 90, 0.32))',
            }}
          >
            <defs>
              <radialGradient id="heartBodyGrad" cx="35%" cy="28%" r="72%">
                <stop offset="0%" stopColor="#ff9bb5" />
                <stop offset="32%" stopColor="#ff4775" />
                <stop offset="72%" stopColor="#ec1c54" />
                <stop offset="100%" stopColor="#b80b3d" />
              </radialGradient>
              <radialGradient id="heartInnerGlow" cx="65%" cy="68%" r="55%">
                <stop offset="0%" stopColor="#ff7aa0" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#ff7aa0" stopOpacity="0" />
              </radialGradient>
              <filter id="specBlur" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4.5" />
              </filter>
            </defs>

            <path
              d="M100 172 C95 168 18 118 18 62 C18 30 43 12 68 12 C84 12 95 22 100 33 C105 22 116 12 132 12 C157 12 182 30 182 62 C182 118 105 168 100 172 Z"
              fill="url(#heartBodyGrad)"
            />
            <path
              d="M100 172 C95 168 18 118 18 62 C18 30 43 12 68 12 C84 12 95 22 100 33 C105 22 116 12 132 12 C157 12 182 30 182 62 C182 118 105 168 100 172 Z"
              fill="url(#heartInnerGlow)"
            />

            <ellipse
              cx="60"
              cy="48"
              rx="18"
              ry="11"
              transform="rotate(-26 60 48)"
              fill="#ffffff"
              opacity="0.72"
              filter="url(#specBlur)"
            />
            <ellipse
              cx="56"
              cy="44"
              rx="7"
              ry="4"
              transform="rotate(-26 56 44)"
              fill="#ffffff"
              opacity="0.88"
            />
          </svg>
        </div>
      </div>

      {/* Dotted Trajectory Aim Preview when pulling */}
      {isDragging && pullAmount > 0.14 && arrowPhase === 'nocked' && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${size.width} ${size.height}`}
        >
          {Array.from({ length: 12 }).map((_, i) => {
            const stepDist = (i + 1) * 34;
            const px = bowPos.x + Math.cos(bowAngle) * stepDist;
            const py = bowPos.y + Math.sin(bowAngle) * stepDist;
            return (
              <circle
                key={i}
                cx={px}
                cy={py}
                r={Math.max(1.4, 3 - i * 0.14)}
                fill="#7a2c2c"
                opacity={Math.max(0.08, 0.42 - i * 0.03)}
              />
            );
          })}
        </svg>
      )}

      {/* Interactive Bow (with Nocked Arrow when ready) */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: bowPos.x,
          top: bowPos.y,
          transform: `translate(-50%, -50%) rotate(${bowAngle}rad) scale(${bowScale})`,
          transformOrigin: 'center center',
        }}
      >
        <svg width="160" height="160" viewBox="-80 -80 160 160" className="overflow-visible">
          <defs>
            <linearGradient id="bowWood" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4f291f" />
              <stop offset="50%" stopColor="#2c1510" />
              <stop offset="100%" stopColor="#1b0c09" />
            </linearGradient>
            <linearGradient id="arrowTip" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#d99b43" />
              <stop offset="100%" stopColor="#f6d28b" />
            </linearGradient>
          </defs>

          <polyline
            points={`-4,-52 ${-8 - stringPullPx},0 -4,52`}
            fill="none"
            stroke="rgba(74, 42, 34, 0.65)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d="M -4 -52 C 14 -38, 16 -18, 12 -8 L 12 8 C 16 18, 14 38, -4 52"
            fill="none"
            stroke="url(#bowWood)"
            strokeWidth="5.2"
            strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 4px 6px rgba(40,18,12,0.22))' }}
          />
          <rect x="8" y="-9" width="7" height="18" rx="3" fill="#23100c" />

          {arrowPhase === 'nocked' && (
            <g transform={`translate(${-stringPullPx}, 0)`}>
              <line
                x1="-12"
                y1="0"
                x2="46"
                y2="0"
                stroke="#3a1e16"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path d="M -12 0 L -21 -6 L -15 0 L -21 6 Z" fill="#e11d48" opacity="0.92" />
              <path d="M -6 0 L -14 -4.5 L -9 0 L -14 4.5 Z" fill="#fb7185" opacity="0.88" />
              <polygon points="44,-4.5 57,0 44,4.5" fill="url(#arrowTip)" />
            </g>
          )}
        </svg>
      </div>

      {/* Flying or Embedded Arrow */}
      {(arrowPhase === 'flying' || arrowPhase === 'stuck') && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: arrowPos.x,
            top: arrowPos.y,
            transform: `translate(-50%, -50%) rotate(${arrowAngle}rad) scale(${bowScale})`,
            transformOrigin: 'center center',
          }}
        >
          <svg width="110" height="40" viewBox="-55 -20 110 40" className="overflow-visible">
            <defs>
              <linearGradient id="flyingTip" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#d99b43" />
                <stop offset="100%" stopColor="#f6d28b" />
              </linearGradient>
            </defs>
            <line
              x1="-34"
              y1="0"
              x2={arrowPhase === 'stuck' ? '6' : '24'}
              y2="0"
              stroke="#3a1e16"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <path d="M -34 0 L -44 -6.5 L -37 0 L -44 6.5 Z" fill="#e11d48" />
            <path d="M -27 0 L -36 -5 L -30 0 L -36 5 Z" fill="#fb7185" />
            {arrowPhase === 'flying' && (
              <polygon points="22,-4.5 35,0 22,4.5" fill="url(#flyingTip)" />
            )}
          </svg>
        </div>
      )}

      {/* Subtle PULL & RELEASE hint */}
      <div
        className="absolute bottom-7 left-0 right-0 flex justify-center pointer-events-none transition-opacity duration-400"
        style={{ opacity: hintVisible ? 1 : 0 }}
      >
        <span className="text-[11px] sm:text-xs tracking-[0.26em] uppercase text-[#6e463b] animate-pulse-hint font-medium">
          PULL &amp; RELEASE
        </span>
      </div>

      {/* Expanding Crimson Shockwave Transition into Scene 2 */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          left: heartPos.x,
          top: heartPos.y,
          width: 40,
          height: 40,
          background:
            'radial-gradient(circle at 40% 40%, #ff5a7a 0%, #ef234c 45%, #c9123a 100%)',
          transform: `translate(-50%, -50%) scale(${expandWave ? Math.ceil(Math.hypot(size.width, size.height) / 14) : 0})`,
          opacity: expandWave ? 1 : 0,
          transition:
            'transform 720ms cubic-bezier(0.32, 0, 0.18, 1), opacity 180ms ease-out',
        }}
      />
    </div>
  );
};
