import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const INACTIVITY_LIMIT_MS = 4 * 60 * 60 * 1000;       // 4 horas
const WARNING_BEFORE_MS = 2 * 60 * 1000;               // advertir 2 min antes
const CHECK_INTERVAL_MS = 60 * 1000;                   // revisar cada 60s
const STORAGE_KEY = 'lastActivityAt';

export function useInactivityLogout() {
  const [showWarning, setShowWarning] = useState(false);
  const intervalRef = useRef(null);

  const updateActivity = () => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setShowWarning(false);
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    base44.auth.logout();
  };

  useEffect(() => {
    // Inicializar si no existe
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    }

    // Eventos de actividad del usuario
    const activityEvents = ['click', 'scroll', 'keydown', 'mousemove', 'touchstart'];
    activityEvents.forEach(evt => window.addEventListener(evt, updateActivity, { passive: true }));

    // Revisar inactividad periódicamente
    intervalRef.current = setInterval(() => {
      const lastActivity = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
      const inactiveTime = Date.now() - lastActivity;

      if (inactiveTime >= INACTIVITY_LIMIT_MS) {
        handleLogout();
      } else if (inactiveTime >= INACTIVITY_LIMIT_MS - WARNING_BEFORE_MS) {
        setShowWarning(true);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      activityEvents.forEach(evt => window.removeEventListener(evt, updateActivity));
      clearInterval(intervalRef.current);
    };
  }, []);

  return { showWarning, updateActivity };
}