import { useEffect, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

export default function ExamTimer({ expiresAt, onExpire }) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const calc = () => Math.max(0, Math.floor((new Date(expiresAt) - new Date()) / 1000));
    setSecondsLeft(calc());

    const interval = setInterval(() => {
      const s = calc();
      setSecondsLeft(s);
      if (s === 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  const pad = n => String(n).padStart(2, '0');

  const isWarning = secondsLeft <= 600; // últimos 10 minutos
  const isCritical = secondsLeft <= 120; // últimos 2 minutos

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-lg
      ${isCritical ? 'bg-red-100 text-red-700 animate-pulse' : isWarning ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-50 text-blue-700'}`}>
      {isCritical ? <AlertTriangle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
      {h > 0 ? `${pad(h)}:` : ''}{pad(m)}:{pad(s)}
    </div>
  );
}