import React from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Flame, Star, Zap, ArrowRight } from "lucide-react";

// Calcula XP necesario para el siguiente nivel (curva sqrt)
function xpForLevel(level) {
  return Math.round(100 * Math.pow(level, 1.5));
}

export default function HeroBanner({ user, gamProfile, nextSubject, onContinue }) {
  const firstName = user?.full_name?.split(' ')[0] || 'Estudiante';
  const streakDays = gamProfile?.streak_days || 0;
  const xp = gamProfile?.xp_points || 0;
  const level = gamProfile?.level || 1;
  const xpNeeded = xpForLevel(level + 1);
  const xpProgress = Math.min(100, Math.round((xp / xpNeeded) * 100));

  const weeklyProgress = gamProfile?.weekly_goal_progress || 0;
  const weeklyTarget = gamProfile?.weekly_goal_target || 0;
  const weeklyPercent = weeklyTarget > 0 ? Math.min(100, Math.round((weeklyProgress / weeklyTarget) * 100)) : 0;

  return (
    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-violet-700 text-white p-6 md:p-8 shadow-xl">
      {/* Decoración */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-6">
        {/* Saludo + métricas */}
        <div className="flex-1 space-y-4">
          <div>
            <p className="text-blue-200 text-sm font-medium uppercase tracking-wide">Bienvenido de vuelta</p>
            <h1 className="text-3xl md:text-4xl font-bold mt-1">¡Hola, {firstName}! 👋</h1>
          </div>

          {/* Métricas de gamificación */}
          <div className="flex flex-wrap gap-4">
            {/* Racha */}
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2">
              <Flame className="w-5 h-5 text-orange-300" />
              <div>
                <p className="text-lg font-bold leading-none">{streakDays}</p>
                <p className="text-blue-200 text-xs">días de racha</p>
              </div>
            </div>

            {/* XP */}
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2">
              <Star className="w-5 h-5 text-yellow-300" />
              <div>
                <p className="text-lg font-bold leading-none">{xp.toLocaleString()}</p>
                <p className="text-blue-200 text-xs">XP acumulados</p>
              </div>
            </div>

            {/* Nivel */}
            <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2">
              <Zap className="w-5 h-5 text-green-300" />
              <div>
                <p className="text-lg font-bold leading-none">Nivel {level}</p>
                <p className="text-blue-200 text-xs">{xpProgress}% al siguiente</p>
              </div>
            </div>
          </div>

          {/* Barras de progreso */}
          <div className="space-y-3">
            {/* XP progress */}
            <div>
              <div className="flex justify-between text-xs text-blue-200 mb-1">
                <span>Progreso de nivel</span>
                <span>{xp} / {xpNeeded} XP</span>
              </div>
              <Progress value={xpProgress} className="h-2 bg-white/20 [&>div]:bg-yellow-400" />
            </div>

            {/* Meta semanal */}
            {weeklyTarget > 0 && (
              <div>
                <div className="flex justify-between text-xs text-blue-200 mb-1">
                  <span>Meta semanal</span>
                  <span>{weeklyProgress}/{weeklyTarget} lecciones</span>
                </div>
                <Progress value={weeklyPercent} className="h-2 bg-white/20 [&>div]:bg-green-400" />
              </div>
            )}
          </div>
        </div>

        {/* CTA principal */}
        <div className="flex flex-col items-start lg:items-center gap-3 lg:min-w-[220px]">
          {nextSubject ? (
            <>
              <div className="bg-white/10 rounded-xl p-4 w-full text-center">
                <p className="text-blue-200 text-xs uppercase tracking-wide mb-1">Siguiente paso</p>
                <p className="font-bold text-lg leading-tight">{nextSubject.name}</p>
                <p className="text-blue-200 text-sm mt-1">
                  {nextSubject.progress > 0 ? `${nextSubject.progress}% completado` : 'Sin empezar'}
                </p>
              </div>
              <Button
                size="lg"
                className="w-full bg-white text-blue-700 hover:bg-blue-50 font-bold text-base shadow-lg"
                onClick={onContinue}
              >
                {nextSubject.progress > 0 ? 'Continuar aprendizaje' : 'Comenzar ahora'}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </>
          ) : (
            <Button
              size="lg"
              className="w-full bg-white text-blue-700 hover:bg-blue-50 font-bold text-base shadow-lg"
              onClick={onContinue}
            >
              Ir a mis materias
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}