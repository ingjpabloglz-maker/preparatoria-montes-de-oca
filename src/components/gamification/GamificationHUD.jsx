import React from 'react';
import { Flame, Star, Zap, HeartCrack } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGamificationProfile } from '@/hooks/useGamification';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { getStreakStatus } from '@/lib/streakStatus';

export default function GamificationHUD({ userEmail }) {
  const { data: profile, isLoading } = useGamificationProfile(userEmail);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-14 rounded-full" />
        <Skeleton className="h-7 w-14 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>
    );
  }

  if (!profile) return null;

  const streakStatus = getStreakStatus(profile.last_study_date_normalized);
  const streakDays = profile.streak_days || 0;

  const streakStyle = {
    normal:  'bg-orange-100 text-orange-600',
    at_risk: 'bg-yellow-100 text-yellow-600 animate-pulse',
    lost:    'bg-gray-100 text-gray-400',
    none:    'bg-gray-100 text-gray-400',
  }[streakStatus];

  return (
    <Link to="/Rewards" className="flex items-center gap-3 relative">
      {/* Racha */}
      <div
        className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold transition-colors', streakStyle)}
        title={
          streakStatus === 'at_risk' ? 'Tu racha está en riesgo' :
          streakStatus === 'lost'    ? `Perdiste tu racha de ${streakDays} días` :
          `Racha: ${streakDays} días`
        }
      >
        {streakStatus === 'lost'
          ? <HeartCrack className="w-4 h-4" />
          : <Flame className="w-4 h-4" />
        }
        <span>{streakDays}</span>
      </div>

      {/* Estrellas */}
      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-600 text-sm font-bold">
        <Star className="w-4 h-4" />
        <span>{profile.total_stars || 0}</span>
      </div>

      {/* Rango XP */}
      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-100 text-violet-600 text-sm font-bold">
        <Zap className="w-4 h-4" />
        <span>⚡{profile.level || 1}</span>
      </div>
    </Link>
  );
}