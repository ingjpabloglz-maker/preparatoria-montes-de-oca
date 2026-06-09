import React from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Trophy, RotateCcw, ArrowRight, Flame, Clock } from "lucide-react";

export default function LessonResults({
  lesson, correctCount, totalCount, score, passed,
  isMiniEval, answers, activities, gamificationResult, onContinue, onRetry
}) {
  const totalTime = answers.reduce((s, a) => s + (a.timeSpent || 0), 0);
  const avgTime = answers.length ? Math.round(totalTime / answers.length) : 0;
  const maxStreak = answers.reduce((acc, a) => {
    if (a.correct) { acc.cur++; acc.max = Math.max(acc.max, acc.cur); }
    else acc.cur = 0;
    return acc;
  }, { cur: 0, max: 0 }).max;

  const getScoreColor = () => {
    if (score >= 80) return 'from-green-400 to-emerald-500';
    if (score >= 60) return 'from-amber-400 to-orange-500';
    return 'from-red-400 to-rose-500';
  };

  const getMessage = () => {
    if (isMiniEval) {
      if (passed) return { title: '¡Módulo completado! 🎉', sub: 'Excelente trabajo, puedes continuar al siguiente módulo.' };
      return { title: 'Casi lo logras 💪', sub: 'Necesitas al menos 60% para desbloquear el siguiente módulo. ¡Inténtalo de nuevo!' };
    }
    if (passed) {
      if (score >= 100) return { title: '¡Perfecto absoluto! 🏆', sub: '¡Puntaje perfecto! Eres increíble.' };
      if (score >= 80) return { title: '¡Perfecto! ⭐', sub: 'Dominaste esta lección.' };
      return { title: '¡Buen trabajo! 👍', sub: 'Lección aprobada. Sigue así.' };
    }
    return { title: 'No aprobado 📚', sub: 'Necesitas al menos 60% para avanzar. Puedes repetir la lección.' };
  };

  const { title, sub } = getMessage();
  const isRepeat = gamificationResult?.is_repeat === true;
  const rewardsGranted = gamificationResult?.rewards_granted === true;

  // Desglose de recompensas
  const xpBase = gamificationResult ? (gamificationResult.xp_earned || 0) - (gamificationResult.weekly_bonus_xp || 0) - (gamificationResult.streak_bonus || 0) : 0;
  const streakBonus = gamificationResult?.streak_bonus || 0;
  const weeklyBonusXP = gamificationResult?.weekly_bonus_xp || 0;
  const weeklyBonusStars = gamificationResult?.weekly_bonus_stars || 0;
  const starsBase = (gamificationResult?.stars_earned || 0) - weeklyBonusStars;
  const waterEarned = gamificationResult?.water_tokens_earned || 0;
  const hasRewards = rewardsGranted && (
    (gamificationResult?.xp_earned > 0) ||
    (gamificationResult?.stars_earned > 0) ||
    waterEarned > 0
  );
  const hasBonus = streakBonus > 0 || weeklyBonusXP > 0 || weeklyBonusStars > 0 || gamificationResult?.perfect_score_bonus > 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col items-center text-center py-4">
      {/* Score Circle */}
      <div className={`w-28 h-28 rounded-full bg-gradient-to-br ${getScoreColor()} flex flex-col items-center justify-center mb-5 shadow-lg shadow-black/30`}>
        <span className="text-3xl font-black text-white">{score}%</span>
      </div>

      {/* Message */}
      <h2 className="text-2xl font-bold text-white mb-1.5">{title}</h2>
      <p className="text-white/60 text-sm mb-6 max-w-xs">{sub}</p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-3">
        <div className="bg-white/10 rounded-xl p-3.5 text-center border border-white/10">
          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="text-xl font-bold text-white">{correctCount}</span>
          </div>
          <p className="text-xs text-white/50">Correctas</p>
        </div>
        <div className="bg-white/10 rounded-xl p-3.5 text-center border border-white/10">
          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-xl font-bold text-white">{totalCount - correctCount}</span>
          </div>
          <p className="text-xs text-white/50">Incorrectas</p>
        </div>
      </div>

      {/* Extra stats */}
      {(totalTime > 0 || maxStreak >= 2) && (
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-6">
          {totalTime > 0 && (
            <div className="bg-white/10 rounded-xl p-3.5 text-center border border-white/10">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-xl font-bold text-white">{avgTime}s</span>
              </div>
              <p className="text-xs text-white/50">Tiempo promedio</p>
            </div>
          )}
          {maxStreak >= 2 && (
            <div className="bg-white/10 rounded-xl p-3.5 text-center border border-white/10">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <Flame className="w-4 h-4 text-orange-400" />
                <span className="text-xl font-bold text-white">{maxStreak}</span>
              </div>
              <p className="text-xs text-white/50">Racha máx.</p>
            </div>
          )}
        </div>
      )}

      {/* Progress Bar */}
      <div className="w-full max-w-sm mb-6">
        <div className="flex justify-between text-xs text-white/40 mb-1.5">
          <span>Puntuación</span>
          <span>{score}/100</span>
        </div>
        <Progress value={score} className="h-2.5 bg-white/10" />
      </div>

      {/* === RECOMPENSAS OBTENIDAS === */}
      {hasRewards && (
        <div className="w-full max-w-sm bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4 mb-4">
          <p className="text-xs text-white/50 uppercase tracking-wider text-center mb-4">Recompensas obtenidas</p>

          {/* Recompensas base */}
          <div className="flex items-center justify-center gap-6 flex-wrap mb-3">
            {(xpBase + streakBonus + weeklyBonusXP) > 0 && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl">⚡</span>
                <span className="text-xl font-bold text-yellow-300">+{gamificationResult.xp_earned}</span>
                <span className="text-xs text-white/50">XP</span>
              </div>
            )}
            {(starsBase + weeklyBonusStars) > 0 && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl">⭐</span>
                <span className="text-xl font-bold text-amber-300">+{gamificationResult.stars_earned}</span>
                <span className="text-xs text-white/50">Estrellas</span>
              </div>
            )}
            {waterEarned > 0 && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-3xl">💧</span>
                <span className="text-xl font-bold text-blue-300">+{waterEarned}</span>
                <span className="text-xs text-white/50">Agua</span>
              </div>
            )}
          </div>

          {/* Bonuses desglosados */}
          {hasBonus && (
            <div className="border-t border-white/10 pt-3 space-y-1.5">
              {streakBonus > 0 && (
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-orange-300 flex items-center gap-1">
                    🔥 Racha ×{gamificationResult.multiplier?.toFixed(1)}
                  </span>
                  <span className="text-yellow-300 font-semibold">+{streakBonus} XP</span>
                </div>
              )}
              {weeklyBonusXP > 0 && (
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-green-300 flex items-center gap-1">🎯 Meta semanal</span>
                  <span className="text-yellow-300 font-semibold">+{weeklyBonusXP} XP</span>
                </div>
              )}
              {weeklyBonusStars > 0 && (
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-green-300 flex items-center gap-1">🎯 Meta semanal</span>
                  <span className="text-amber-300 font-semibold">+{weeklyBonusStars} ⭐</span>
                </div>
              )}
              {gamificationResult?.perfect_score_bonus > 0 && (
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-purple-300 flex items-center gap-1">🏆 Puntuación perfecta</span>
                  <span className="text-yellow-300 font-semibold">+{gamificationResult.perfect_score_bonus} XP</span>
                </div>
              )}
            </div>
          )}

          {/* Logros especiales */}
          {gamificationResult?.leveled_up && (
            <p className="text-center text-xs text-purple-300 font-semibold mt-2 pt-2 border-t border-white/10">
              🎉 ¡Subiste al Nivel {gamificationResult.level}!
            </p>
          )}
          {gamificationResult?.weekly_goal_completed && !weeklyBonusXP && (
            <p className="text-center text-xs text-green-300 font-semibold mt-2">
              🎯 ¡Meta semanal completada!
            </p>
          )}
          {gamificationResult?.streak_days > 1 && (
            <p className="text-center text-xs text-orange-200 mt-1">
              Racha de {gamificationResult.streak_days} días consecutivos
            </p>
          )}
        </div>
      )}

      {/* Mensaje lección repetida (no error, solo informativo) */}
      {isRepeat && (
        <div className="w-full max-w-sm bg-white/5 border border-white/15 rounded-xl p-3.5 mb-4 text-center">
          <p className="text-xs text-white/60 leading-relaxed">
            Ya habías completado esta lección anteriormente.<br />
            Tu progreso académico sigue guardado, pero esta lección ya no otorga recompensas adicionales.
          </p>
        </div>
      )}

      {/* Mini Eval result indicator */}
      {isMiniEval && (
        <div className={`w-full max-w-sm rounded-2xl p-4 mb-5 border ${
          passed
            ? 'bg-green-500/20 border-green-500/40'
            : 'bg-amber-500/20 border-amber-500/40'
        }`}>
          <div className="flex items-center gap-2 justify-center">
            {passed
              ? <><Trophy className="w-4 h-4 text-green-400" /><span className="text-sm font-semibold text-green-300">Módulo desbloqueado</span></>
              : <><Flame className="w-4 h-4 text-amber-400" /><span className="text-sm font-semibold text-amber-300">Mínimo requerido: 60%</span></>
            }
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="w-full max-w-sm space-y-2.5">
        {!passed && (
          <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-3 text-center text-sm text-red-300 font-medium">
            Necesitas al menos 60% para avanzar. Repite la lección.
          </div>
        )}
        <Button
          onClick={onContinue}
          disabled={!passed}
          className="w-full h-12 bg-gradient-to-r from-blue-500 to-violet-600 text-white font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isMiniEval && passed ? 'Continuar al siguiente módulo' : 'Ver ruta de aprendizaje'}
          <ArrowRight className="w-4 h-4" />
        </Button>

        <Button
          onClick={onRetry}
          variant="ghost"
          className="w-full h-12 text-white/60 hover:text-white hover:bg-white/10 rounded-xl font-medium flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" /> Repetir lección
        </Button>

        <p className="text-center text-xs text-white/30 pt-1">
          Puedes repetir la lección para mejorar tu puntuación
        </p>
      </div>
    </div>
  );
}