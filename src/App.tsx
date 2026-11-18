import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { SceneArrow } from './components/SceneArrow';
import { SceneWish } from './components/SceneWish';
import { SceneTree } from './components/SceneTree';
import { SceneLoveHeart } from './components/SceneLoveHeart';

type SceneName = 'arrow' | 'wish' | 'tree';

export default function App() {
  const isBirthdayMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('mode') === 'birthday';

  const [scene, setScene] = useState<SceneName>('arrow');
  const [runId, setRunId] = useState(1);
  const [autoPlay, setAutoPlay] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const userMutedRef = useRef(false);

  const audioSrc = isBirthdayMode
    ? '/audio/birthday_music.mp3'
    : '/audio/love_music.mp3';

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.85;

    const handlePlay = () => setIsMusicPlaying(true);
    const handlePause = () => setIsMusicPlaying(false);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    // Try auto-starting immediately in Love Heart mode (falls back cleanly to tap unlock)
    if (!isBirthdayMode && !userMutedRef.current) {
      audio.play().catch(() => {
        // Browser requires user gesture before unmuted audio playback
      });
    }

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [isBirthdayMode]);

  const ensureAudioPlaying = useCallback((restart = false) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (userMutedRef.current && !restart) return;

    if (restart) {
      userMutedRef.current = false;
      audio.muted = false;
      setIsMuted(false);
      audio.currentTime = 0;
    }

    if (audio.paused) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsMusicPlaying(true);
          })
          .catch(() => {
            // Will retry on next touch/click
          });
      }
    }
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      userMutedRef.current = false;
      audio.muted = false;
      setIsMuted(false);
      audio.play().catch(() => {});
      return;
    }

    const nextMuted = !isMuted;
    userMutedRef.current = nextMuted;
    audio.muted = nextMuted;
    setIsMuted(nextMuted);
  }, [isMuted]);

  const handleAutoPlay = useCallback(() => {
    setScene('arrow');
    setAutoPlay(true);
    setRunId((id) => id + 1);
    ensureAudioPlaying(true);
  }, [ensureAudioPlaying]);

  const handleReplay = useCallback(() => {
    setScene('arrow');
    setAutoPlay(false);
    setRunId((id) => id + 1);
    ensureAudioPlaying(true);
  }, [ensureAudioPlaying]);

  if (!isBirthdayMode) {
    return (
      <main className="relative w-screen h-screen overflow-hidden bg-black">
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="auto"
          loop
          playsInline
        />

        <SceneLoveHeart
          onInteract={() => ensureAudioPlaying(false)}
          showTapHint={!isMusicPlaying && !isMuted}
        />

        <div className="fixed top-4 right-4 z-30 flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted || !isMusicPlaying ? 'Unmute background music' : 'Mute background music'}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f6a8ca] bg-white/10 hover:bg-white/20 text-[#f6a8ca] backdrop-blur-sm cursor-pointer"
          >
            {isMuted || !isMusicPlaying ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </main>
    );
  }

  const isDarkScene = scene === 'wish';

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="auto"
        loop
        playsInline
      />

      {scene === 'arrow' && (
        <SceneArrow
          key={`arrow-${runId}`}
          autoPlay={autoPlay}
          onFirstInteract={() => ensureAudioPlaying(false)}
          onComplete={() => setScene('wish')}
        />
      )}

      {scene === 'wish' && (
        <SceneWish
          key={`wish-${runId}`}
          onComplete={() => setScene('tree')}
        />
      )}

      {scene === 'tree' && <SceneTree key={`tree-${runId}`} />}

      <div className="fixed top-4 right-4 z-30 flex items-center gap-2">
        {scene === 'arrow' && !autoPlay && (
          <button
            type="button"
            onClick={handleAutoPlay}
            aria-label="Auto-play birthday gift animation"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium tracking-wide whitespace-nowrap shrink-0 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b1b32] bg-white/45 hover:bg-white/75 text-[#4a231c] backdrop-blur-sm shadow-sm cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Auto Play</span>
          </button>
        )}

        <button
          type="button"
          onClick={toggleMute}
          aria-label={isMuted || !isMusicPlaying ? 'Unmute background music' : 'Mute background music'}
          className={`inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 backdrop-blur-sm shadow-sm cursor-pointer ${
            isDarkScene
              ? 'bg-white/15 hover:bg-white/25 text-white focus-visible:outline-white'
              : 'bg-white/45 hover:bg-white/75 text-[#4a231c] focus-visible:outline-[#9b1b32]'
          }`}
        >
          {isMuted || !isMusicPlaying ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>

        {scene !== 'arrow' && (
          <button
            type="button"
            onClick={handleReplay}
            aria-label="Replay birthday gift"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 backdrop-blur-sm shadow-sm cursor-pointer ${
              isDarkScene
                ? 'bg-white/15 hover:bg-white/25 text-white focus-visible:outline-white'
                : 'bg-white/45 hover:bg-white/75 text-[#4a231c] focus-visible:outline-[#9b1b32]'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Replay</span>
          </button>
        )}
      </div>
    </main>
  );
}
