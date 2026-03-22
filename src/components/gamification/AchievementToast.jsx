import React, { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useSound } from '@/contexts/SoundContext';

const RARITY_COLORS = {
  common: 'bg-gray-100 border-gray-300',
  rare: 'bg-blue-50 border-blue-300',
  epic: 'bg-purple-50 border-purple-300',
  legendary: 'bg-amber-50 border-amber-400',
};

export default function AchievementToast({ userEmail }) {
  const { playSound } = useSound();
  const queryClient = useQueryClient();
  const knownIds = useRef(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    if (!userEmail) return;

    const checkAchievements = async () => {
      const all = await base44.entities.UserAchievement.filter({ user_email: userEmail, is_unlocked: true });

      if (!initialized.current) {
        // Primera carga: solo registrar los existentes sin mostrar toast
        all.forEach(ua => knownIds.current.add(ua.id));
        initialized.current = true;
        return;
      }

      // Verificar nuevos
      const newOnes = all.filter(ua => !knownIds.current.has(ua.id));
      for (const ua of newOnes) {
        knownIds.current.add(ua.id);

        // Obtener detalles del Achievement
        const achs = await base44.entities.Achievement.filter({ id: ua.achievement_id });
        const ach = achs[0];
        if (!ach) continue;

        playSound('achievement_unlocked');

        toast.custom(() => (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${RARITY_COLORS[ach.rarity] || RARITY_COLORS.common}`}>
            <div className="text-2xl">🏆</div>
            <div>
              <p className="font-bold text-sm text-gray-800">¡Logro desbloqueado!</p>
              <p className="text-xs text-gray-600">{ach.name}</p>
              <p className="text-xs text-gray-400 capitalize">{ach.rarity}</p>
            </div>
          </div>
        ), { duration: 4000 });
      }
    };

    // Polling cada 15s solo si la pestaña está activa
    checkAchievements();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkAchievements();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [userEmail]);

  return null;
}