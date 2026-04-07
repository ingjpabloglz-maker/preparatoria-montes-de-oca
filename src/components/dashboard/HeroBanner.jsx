import React from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Flame, Star, Zap, ArrowRight } from "lucide-react";

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
  const xpLeft = Math.max(0, xpNeeded - xp);

  const weeklyProgress = gamProfile?.weekly_goal_progress || 0;
  const weeklyTarget = gamProfile?.weekly_goal_target || 0;
  const weeklyPercent = weeklyTarget > 0 ? Math.min(100, Math.round((weeklyProgress / weeklyTarget) * 100)) : 0;
  const weeklyLeft = Math.max(0, weeklyTarget - weeklyProgress);

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-xl" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 40%, #4f46e5 100%)' }}>
      {/* Decorative circles */}
      <div className="absolute top-0 left-0 w-72 h-72 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)', transform: 'translate(-30%, -30%)' }} />
      <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #818cf8 0%, transparent 70%)', transform: 'translate(20%, 30%)' }} />

      <div className="relative z-10 flex flex-col md:flex-row items-stretch">
        {/* Left: Greeting + illustration */}
        <div className="flex-1 flex items-center gap-4 p-6 md:p-8">
          {/* Illustration */}
          <div className="hidden sm:flex shrink-0 w-32 h-32 md:w-40 md:h-40 items-end justify-center">
            <div className="text-8xl md:text-9xl leading-none select-none" style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}>
              🧑‍🎓
            </div>
          </div>

          {/* Text + CTA */}
          <div className="space-y-3">
            {/* Stars decoration */}
            <div className="flex items-center gap-1 text-yellow-300 text-sm">
              <span>✦</span><span>✦</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              ¡Hola {firstName}! 👋
            </h1>
            <p className="text-blue-100 text-sm leading-relaxed">
              Estás haciendo un gran trabajo.<br />
              <span className="text-yellow-300 font-semibold">Sigue así y alcanzarás tus metas.</span>
            </p>
            <Button
              size="lg"
              className="bg-white text-blue-700 hover:bg-green-50 hover:text-green-700 font-bold text-base shadow-lg rounded-xl px-6 transition-all"
              onClick={onContinue}
            >
              {nextSubject?.progress > 0 ? 'Continuar aprendizaje' : 'Comenzar aprendizaje'}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>

        {/* Right: Stats cards */}
        <div className="flex flex-row md:flex-col justify-center gap-3 p-4 md:p-6 md:pr-8 md:w-72 bg-white/5 backdrop-blur-sm border-t md:border-t-0 md:border-l border-white/10">
          {/* Racha */}
          <div className="flex-1 md:flex-none bg-white/10 rounded-2xl p-4 flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔥</span>
              <span className="text-xs text-blue-200 font-medium">Racha</span>
            </div>
            <p className="text-2xl font-extrabold text-white">{streakDays} días</p>
            <p className="text-xs text-blue-200">
              {streakDays === 0 ? '¡Empieza hoy!' : '¡No la pierdas!'}
            </p>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${Math.min(100, (streakDays / 30) * 100)}%` }} />
            </div>
          </div>

          {/* Meta semanal */}
          <div className="flex-1 md:flex-none bg-white/10 rounded-2xl p-4 flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎯</span>
              <span className="text-xs text-blue-200 font-medium">Meta semanal</span>
            </div>
            {weeklyTarget > 0 ? (
              <>
                <p className="text-2xl font-extrabold text-white">{weeklyProgress} / {weeklyTarget} clases</p>
                <p className="text-xs text-blue-200">Te faltan {weeklyLeft} clases</p>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-cyan-400 rounded-full transition-all" style={{ width: `${weeklyPercent}%` }} />
                </div>
              </>
            ) : (
              <>
                <p className="text-2xl font-extrabold text-white">Sin meta</p>
                <p className="text-xs text-blue-200">Configura tu meta</p>
                <div className="h-1.5 bg-white/20 rounded-full mt-1" />
              </>
            )}
          </div>

          {/* XP actual */}
          <div className="flex-1 md:flex-none bg-white/10 rounded-2xl p-4 flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">⭐</span>
              <span className="text-xs text-blue-200 font-medium">XP actual</span>
            </div>
            <p className="text-2xl font-extrabold text-white">{xp.toLocaleString()} XP</p>
            <p className="text-xs text-blue-200">Faltan {xpLeft} XP</p>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-purple-400 rounded-full transition-all" style={{ width: `${xpProgress}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}