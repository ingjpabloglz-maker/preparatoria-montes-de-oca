import React from 'react';
import { Target, Trophy, Clock, Star, Zap } from 'lucide-react';

// Calcula días restantes en la semana del usuario (7 días desde weeklyStartDate)
function getDaysRemaining(weeklyStartDate) {
  if (!weeklyStartDate) return null;
  const start = new Date(weeklyStartDate + 'T00:00:00Z');
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffMs = end - now;
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export default function WeeklyGoal({ profile }) {
  const target = profile?.weekly_goal_target;
  const progress = profile?.weekly_goal_progress ?? 0;
  const completed = profile?.weekly_goal_completed ?? false;
  const rewardClaimed = profile?.weekly_goal_reward_claimed ?? false;
  const startDate = profile?.weekly_goal_start_date;

  // Si no hay meta configurada, no renderizar (el Dashboard muestra el modal)
  if (!target) return null;

  const pct = Math.min(100, Math.round((progress / target) * 100));
  const daysLeft = getDaysRemaining(startDate);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-gray-700 text-sm">Meta semanal</span>
        </div>
        <div className="flex items-center gap-3">
          {daysLeft !== null && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {daysLeft === 0 ? 'Semana terminando' : `${daysLeft}d restantes`}
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

      {/* Mensaje de estado */}
      {completed && rewardClaimed && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <Trophy className="w-4 h-4 text-green-600 flex-shrink-0" />
          <p className="text-xs font-semibold text-green-700">
            ¡Meta completada! Recibiste 50 XP + 3 ⭐
          </p>
        </div>
      )}

      {!completed && pct >= 80 && (
        <p className="text-xs font-medium text-orange-500">🔥 ¡Casi lo logras! Solo {target - progress} lección(es) más.</p>
      )}

      {!completed && pct >= 50 && pct < 80 && (
        <p className="text-xs font-medium text-blue-600">💪 ¡Vas muy bien! Sigue así.</p>
      )}

      {!completed && pct < 50 && (
        <p className="text-xs text-gray-400">{pct}% completado · Completa tu meta para ganar 50 XP + 3 ⭐</p>
      )}
    </div>
  );
}