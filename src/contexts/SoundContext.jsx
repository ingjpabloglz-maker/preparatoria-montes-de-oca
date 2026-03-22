import React, { createContext, useContext, useState, useEffect } from 'react';

const SoundContext = createContext({ isSoundEnabled: false, toggleSound: () => {} });

export function SoundProvider({ children }) {
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    // Default OFF
    const stored = localStorage.getItem('sound_enabled');
    return stored === 'true';
  });

  const toggleSound = () => {
    setIsSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('sound_enabled', String(next));
      return next;
    });
  };

  const playSound = (soundName) => {
    if (!isSoundEnabled) return;
    const audio = new Audio(`/sounds/${soundName}.mp3`);
    audio.volume = 0.4;
    audio.play().catch(() => {}); // silenciar errores si el archivo no existe
  };

  return (
    <SoundContext.Provider value={{ isSoundEnabled, toggleSound, playSound }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  return useContext(SoundContext);
}