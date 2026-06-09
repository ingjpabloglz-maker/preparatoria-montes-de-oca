import React from 'react';
import { Target, Trophy, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Calcula segundos restantes para la sesión activa (rolling 7-day desde started_at)
function getSecondsRemaining(expiresAt) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt) - new Date();
  return diff <= 0 ? 0 : Math.floor(diff / 1000);
}

function formatTimeRemaining(seconds) {
  if (seconds === null) return null;
  if (seconds <= 0) return 'Semana terminando';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h restantes`;
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m restantes`;
}

export default function WeeklyGoal({ profile, activeGoalSession, onNewGoal }) {
  // Fuente de verdad: activeGoalSession (WeeklyGoalSession). Fallback a campos legacy del profile.
  const session = activeGoalSession;

  const target    = session?.target    ?? profile?.weekly_goal_target    ?? null;
  const progress  = session?.progress  ?? profile?.weekly_goal_progress  ?? 0;
  const completed = session?.completed ?? profile?.weekly_goal_completed ?? false;
  const rewardXP    = session?.reward_xp    ?? 50;
  const rewardStars = session?.reward_stars ?? 3;
  const expiresAt = session?.expires_at ?? null;

  if (!target) return null;

  const pct = Math.min(100, Math.round((progress / target) * 100));
  const secondsLeft = getSecondsRemaining(expiresAt);
  const timeLabel = formatTimeRemaining(secondsLeft);
  const rewardClaimed = session?.reward_claimed ?? profile?.weekly_goal_reward_claimed ?? false;
  const goalNumber = session?.goal_number_in_cycle ?? 1;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-gray-700 text-sm">
            Meta semanal
            {goalNumber > 1 && (
              <span className="ml-1.5 text-xs text-gray-400 font-normal">(#{goalNumber} este ciclo)</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {timeLabel && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeLabel}
            </span>
          )}
          <span className="text-sm font-bold text-gray-700">{progress} / {target}</span>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
        <div
          className={`h-3 rounded-full transition-all duration-700 ${
            completed
              ? 'bg-gradient-to-r from-green-400 to-emerald-500'
              : 'bg-gradient-to-r from-blue-500 to-violet-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Estado completado */}
      {completed && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-green-600 flex-shrink-0" />
            <p className="text-xs font-semibold text-green-700">
              ¡Meta completada!
              {rewardXP > 0 || rewardStars > 0 ? (
                <span className="font-normal text-green-600 ml-1">
                  Recibiste {rewardXP > 0 ? `${rewardXP} XP` : ''}{rewardXP > 0 && rewardStars > 0 ? ' + ' : ''}{rewardStars > 0 ? `${rewardStars} ⭐` : ''}
                </span>
              ) : (
                <span className="font-normal text-gray-400 ml-1">(sin recompensa extra este ciclo)</span>
              )}
            </p>
          </div>
          {onNewGoal && (
            <Button
              size="sm"
              variant="outline"
              className="border-green-300 text-green-700 hover:bg-green-100 h-8 text-xs font-semibold shrink-0"
              onClick={onNewGoal}
            >
              🎯 Otra meta
            </Button>
          )}
        </div>
      )}

      {/* Mensajes de progreso (solo si no completada) */}
      {!completed && pct >= 80 && (
        <p className="text-xs font-medium text-orange-500">
          🔥 ¡Casi lo logras! Solo {target - progress} lección{target - progress !== 1 ? 'es' : ''} más.
        </p>
      )}
      {!completed && pct >= 50 && pct < 80 && (
        <p className="text-xs font-medium text-blue-600">💪 ¡Vas muy bien! Sigue así.</p>
      )}
      {!completed && pct < 50 && (
        <p className="text-xs text-gray-400">
          {pct}% completado
          {rewardXP > 0 && ` · Completa tu meta para ganar ${rewardXP} XP${rewardStars > 0 ? ` + ${rewardStars} ⭐` : ''}`}
          {rewardXP === 0 && ' · Meta adicional — sin recompensa extra'}
        </p>
      )}

      {/* Indicador de recompensa si no completada */}
      {!completed && rewardXP > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-amber-600">
          <Zap className="w-3 h-3" />
          <span>Recompensa disponible: {rewardXP} XP {rewardStars > 0 ? `+ ${rewardStars} ⭐` : ''}</span>
        </div>
      )}
    </div>
  );
}