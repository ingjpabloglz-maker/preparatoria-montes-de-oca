import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

const VOLUME_LEVELS = { low: 0.05, medium: 0.12, high: 0.22 };
const COOLDOWN_MS = 150;

const SoundContext = createContext({
  isSoundEnabled: false,
  volume: 'medium',
  toggleSound: () => {},
  setVolume: () => {},
  playSound: () => {},
});

export function SoundProvider({ children }) {
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    const stored = localStorage.getItem('sound_enabled');
    return stored === null ? true : stored === 'true';
  });
  const [volume, setVolumeState] = useState(() => {
    return localStorage.getItem('sound_volume') || 'medium';
  });

  const audioCtxRef = useRef(null);
  const lastPlayedRef = useRef(0);

  // Obtiene o crea el AudioContext singleton
  const getCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      console.log('[SOUND] AudioContext created, state:', audioCtxRef.current.state);
    }
    return audioCtxRef.current;
  }, []);

  // Desbloquea el AudioContext en la primera interacción del usuario
  const unlockCtx = useCallback(() => {
    const ctx = getCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        console.log('[SOUND_CONTEXT_UNLOCKED] AudioContext resumed via user interaction');
      });
    }
  }, [getCtx]);

  useEffect(() => {
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(e => window.addEventListener(e, unlockCtx, { once: true, passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, unlockCtx));
  }, [unlockCtx]);

  const toggleSound = () => {
    setIsSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('sound_enabled', String(next));
      return next;
    });
  };

  const setVolume = (level) => {
    if (!VOLUME_LEVELS[level]) return;
    setVolumeState(level);
    localStorage.setItem('sound_volume', level);
  };

  const playSound = useCallback((soundName) => {
    if (!isSoundEnabled) {
      console.log('[SOUND_BLOCKED] Sound disabled by user');
      return;
    }

    // Cooldown anti-spam
    const now = Date.now();
    if (now - lastPlayedRef.current < COOLDOWN_MS) {
      console.log('[SOUND_BLOCKED] Cooldown active, skipping:', soundName);
      return;
    }
    lastPlayedRef.current = now;

    try {
      const ctx = getCtx();

      if (ctx.state === 'suspended') {
        console.log('[SOUND_BLOCKED] AudioContext suspended (awaiting user interaction)');
        return;
      }

      const gain = ctx.createGain();
      const gainValue = VOLUME_LEVELS[volume] ?? VOLUME_LEVELS.medium;
      gain.connect(ctx.destination);

      const osc = ctx.createOscillator();
      osc.connect(gain);

      const t = ctx.currentTime;

      if (soundName === 'correct_answer') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, t);       // C5
        osc.frequency.setValueAtTime(659.25, t + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, t + 0.16); // G5
        gain.gain.setValueAtTime(gainValue, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.start(t);
        osc.stop(t + 0.35);
      } else if (soundName === 'incorrect_answer') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, t);          // A3
        osc.frequency.setValueAtTime(196, t + 0.12);   // G3
        gain.gain.setValueAtTime(gainValue * 0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
      } else if (soundName === 'lesson_completed') {
        // Fanfarria de lección completada: acorde ascendente C5-E5-G5-C6
        const freqs = [523.25, 659.25, 783.99, 1046.50];
        const offsets = [0, 0.12, 0.24, 0.38];
        osc.disconnect();
        freqs.forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.type = 'sine';
          o.frequency.setValueAtTime(freq, t + offsets[i]);
          g.gain.setValueAtTime(0, t + offsets[i]);
          g.gain.linearRampToValueAtTime(gainValue, t + offsets[i] + 0.04);
          g.gain.exponentialRampToValueAtTime(0.001, t + offsets[i] + 0.3);
          o.start(t + offsets[i]);
          o.stop(t + offsets[i] + 0.35);
        });
        return; // ya no necesitamos osc ni gain originales
      } else {
        // Sonido genérico de notificación
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t);
        gain.gain.setValueAtTime(gainValue * 0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.2);
      }

      console.log(`[SOUND_PLAYED] ${soundName} | volume: ${volume} | ctx state: ${ctx.state}`);
    } catch (err) {
      console.warn('[SOUND_BLOCKED] Error playing sound:', err.message);
    }
  }, [isSoundEnabled, volume, getCtx]);

  return (
    <SoundContext.Provider value={{ isSoundEnabled, volume, toggleSound, setVolume, playSound }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  return useContext(SoundContext);
}