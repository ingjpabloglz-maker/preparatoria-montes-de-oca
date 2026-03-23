import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Target } from 'lucide-react';

export default function WeeklyGoal({ profile }) {
  const target = profile?.weekly_goal_target ?? 10;
  const progress = profile?.weekly_goal_progress ?? 0;
  const pct = Math.min(100, Math.round((progress / target) * 100));

  let message = null;
  let messageColor = '';
  if (pct >= 100) {
    message = '🏆 ¡Meta semanal completada! ¡Increíble!';
    messageColor = 'text-green-600';
  } else if (pct >= 80) {
    message = '🔥 ¡Casi lo logras! Solo un poco más.';
    messageColor = 'text-orange-500';
  } else if (pct >= 50) {
    message = '💪 ¡Vas muy bien! Sigue así.';
    messageColor = 'text-blue-600';
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-gray-700 text-sm">Meta semanal</span>
        </div>
        <span className="text-sm font-bold text-gray-700">{progress} / {target} lecciones</span>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
        <div
          className="h-3 rounded-full transition-all duration-700 bg-gradient-to-r from-blue-500 to-violet-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {message && (
        <p className={`text-xs font-medium ${messageColor}`}>{message}</p>
      )}

      {!message && (
        <p className="text-xs text-gray-400">{pct}% completado</p>
      )}
    </div>
  );
}