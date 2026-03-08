import React from 'react';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Trophy, RotateCcw, ArrowRight, Star, Zap } from "lucide-react";

export default function LessonResults({
  lesson, correctCount, totalCount, score, passed,
  isMiniEval, answers, activities, onContinue, onRetry
}) {
  const getScoreColor = () => {
    if (score >= 80) return 'from-green-400 to-emerald-500';
    if (score >= 60) return 'from-amber-400 to-orange-500';
    return 'from-red-400 to-rose-500';
  };

  const getMessage = () => {
    if (isMiniEval) {
      if (passed) return { title: '¡Módulo completado! 🎉', sub: 'Excelente trabajo, puedes continuar al siguiente módulo.' };
      return { title: 'Casi lo logras 💪', sub: 'Necesitas 80% para desbloquear el siguiente módulo. ¡Inténtalo de nuevo!' };
    }
    if (score >= 80) return { title: '¡Perfecto! ⭐', sub: 'Dominaste esta lección.' };
    if (score >= 60) return { title: '¡Buen trabajo! 👍', sub: 'Lección completada. Sigue así.' };
    return { title: 'Completado 📚', sub: 'Revisa la explicación e inténtalo de nuevo para mejorar.' };
  };

  const { title, sub } = getMessage();

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
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-6">
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

      {/* Progress Bar */}
      <div className="w-full max-w-sm mb-6">
        <div className="flex justify-between text-xs text-white/40 mb-1.5">
          <span>Puntuación</span>
          <span>{score}/100</span>
        </div>
        <Progress value={score} className="h-2.5 bg-white/10" />
      </div>

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
              : <><Zap className="w-4 h-4 text-amber-400" /><span className="text-sm font-semibold text-amber-300">Mínimo requerido: 80%</span></>
            }
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="w-full max-w-sm space-y-2.5">
        <Button
          onClick={onContinue}
          className="w-full h-12 bg-gradient-to-r from-blue-500 to-violet-600 text-white font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
        >
          {isMiniEval && passed ? 'Continuar al siguiente módulo' : 'Ver ruta de aprendizaje'}
          <ArrowRight className="w-4 h-4" />
        </Button>

        {(!passed || !isMiniEval) && (
          <Button
            onClick={onRetry}
            variant="ghost"
            className="w-full h-12 text-white/60 hover:text-white hover:bg-white/10 rounded-xl font-medium flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Intentar de nuevo
          </Button>
        )}
      </div>
    </div>
  );
}