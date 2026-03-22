import React from 'react';
import { Flame, Star, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useGamificationProfile } from '@/hooks/useGamification';
import { cn } from '@/lib/utils';

export default function GamificationHUD({ userEmail }) {
  const { data: profile } = useGamificationProfile(userEmail);

  if (!profile) return null;

  return (
    <Link to="/Rewards" className="flex items-center gap-3">
      {/* Racha */}
      <div className={cn(
        "flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold transition-colors",
        (profile.streak_days || 0) > 0
          ? "bg-orange-100 text-orange-600"
          : "bg-gray-100 text-gray-400"
      )}>
        <Flame className="w-4 h-4" />
        <span>{profile.streak_days || 0}</span>
      </div>

      {/* Estrellas */}
      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-600 text-sm font-bold">
        <Star className="w-4 h-4" />
        <span>{profile.total_stars || 0}</span>
      </div>

      {/* Nivel */}
      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-100 text-violet-600 text-sm font-bold">
        <Zap className="w-4 h-4" />
        <span>Nv.{profile.level || 1}</span>
      </div>
    </Link>
  );
}