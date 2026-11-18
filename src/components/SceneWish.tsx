import React, { useEffect, useRef, useState } from 'react';

interface SceneWishProps {
  onComplete: () => void;
}

export const SceneWish: React.FC<SceneWishProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'enter' | 'burst' | 'filled'>('enter');
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    // 1. Hold crimson "Happy Birthday" reveal, then trigger expanding golden sunburst orb
    const burstTimer = window.setTimeout(() => {
      setPhase('burst');
    }, 2450);

    // 2. Once golden orb fills the entire frame, hold briefly like image_5d0c27f8 then enter Scene 3
    const filledTimer = window.setTimeout(() => {
      setPhase('filled');
    }, 3150);

    const completeTimer = window.setTimeout(() => {
      onCompleteRef.current();
    }, 3450);

    return () => {
      window.clearTimeout(burstTimer);
      window.clearTimeout(filledTimer);
      window.clearTimeout(completeTimer);
    };
  }, []);

  const isBursting = phase === 'burst' || phase === 'filled';

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none px-6"
      style={{
        background: `
          radial-gradient(ellipse 52% 55% at 18% 24%, rgba(255, 146, 152, 0.56) 0%, transparent 65%),
          radial-gradient(ellipse 40% 45% at 82% 76%, rgba(255, 185, 120, 0.22) 0%, transparent 65%),
          radial-gradient(ellipse 75% 75% at 50% 48%, #f1244d 0%, #d8143e 68%, #b90d34 100%)
        `,
      }}
    >
      {/* Soft warm floating dust motes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { left: '18%', top: '65%', delay: '0s', size: 4 },
          { left: '34%', top: '78%', delay: '0.4s', size: 3 },
          { left: '62%', top: '72%', delay: '0.8s', size: 5 },
          { left: '78%', top: '60%', delay: '0.2s', size: 3.5 },
          { left: '48%', top: '82%', delay: '1.1s', size: 4 },
        ].map((mote, idx) => (
          <span
            key={idx}
            className="absolute rounded-full bg-amber-100/45"
            style={{
              left: mote.left,
              top: mote.top,
              width: mote.size,
              height: mote.size,
              animation: `floatMote 3.4s ease-out ${mote.delay} infinite`,
            }}
          />
        ))}
      </div>

      {/* Central Typography Lockup */}
      <div
        className="relative z-10 flex flex-col items-center text-center transition-all duration-500 ease-out"
        style={{
          opacity: phase === 'filled' ? 0 : 1,
          transform: isBursting ? 'scale(1.03)' : 'scale(1)',
        }}
      >
        <p
          className="font-serif-display italic text-[#fff2f4]/90 mb-3 sm:mb-4 opacity-0 animate-fade-slide-up"
          style={{
            fontSize: 'clamp(0.95rem, 1.8vw, 1.25rem)',
            animationDelay: '120ms',
          }}
        >
          make a wish...
        </p>

        <h1
          className="font-serif-display font-bold text-[#fff9f7] tracking-tight leading-[0.95]"
          style={{
            fontSize: 'clamp(3.2rem, 8.8vw, 7.2rem)',
            textShadow: '0 8px 28px rgba(130, 8, 32, 0.34)',
          }}
        >
          <span className="block overflow-hidden pb-1">
            <span
              className="block opacity-0 animate-reveal-up"
              style={{ animationDelay: '240ms' }}
            >
              Happy
            </span>
          </span>
          <span className="block overflow-hidden pt-0.5 pb-2">
            <span
              className="block opacity-0 animate-reveal-up"
              style={{ animationDelay: '400ms' }}
            >
              Birthday
            </span>
          </span>
        </h1>

        <p
          className="font-serif-display italic text-[#fff2f4]/85 mt-3 sm:mt-4 opacity-0 animate-fade-slide-up"
          style={{
            fontSize: 'clamp(0.9rem, 1.6vw, 1.15rem)',
            animationDelay: '720ms',
          }}
        >
          to someone worth celebrating
        </p>
      </div>

      {/* Expanding Luminous Golden-Peach Sunburst Orb Transition into Scene 3 */}
      <div
        className="absolute left-1/2 top-1/2 z-20 rounded-full pointer-events-none"
        style={{
          width: '120vmax',
          height: '120vmax',
          background:
            'radial-gradient(circle, #fffdf6 0%, #ffefc7 22%, #ffd08d 46%, #fca87c 70%, rgba(252, 168, 124, 0) 92%)',
          transform: `translate(-50%, -50%) scale(${
            phase === 'filled' ? 2.1 : phase === 'burst' ? 1.55 : 0
          })`,
          opacity: isBursting ? 1 : 0,
          filter: phase === 'filled' ? 'blur(0px)' : 'blur(18px)',
          transition:
            'transform 780ms cubic-bezier(0.32, 0, 0.18, 1), opacity 220ms ease-out, filter 450ms ease-out',
        }}
      />

      {/* Full-Screen Golden Sunlit Base Layer once Burst Completes */}
      <div
        className="absolute inset-0 z-20 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: phase === 'filled' ? 1 : 0,
          background: `
            radial-gradient(ellipse 46% 52% at 28% 26%, rgba(255, 250, 232, 0.96) 0%, transparent 66%),
            radial-gradient(ellipse 52% 62% at 62% 58%, rgba(255, 236, 195, 0.86) 0%, transparent 65%),
            linear-gradient(145deg, #fde3ba 0%, #fbd0a0 52%, #f6bc8d 100%)
          `,
        }}
      />
    </div>
  );
};
