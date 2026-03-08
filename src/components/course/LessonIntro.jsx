import React from 'react';
import { Button } from "@/components/ui/button";
import { BookOpen, ClipboardList, CheckCircle2, Star, Zap } from "lucide-react";

export default function LessonIntro({ lesson, activitiesCount, isMiniEval, alreadyCompleted, previousScore, onStart }) {
  return (
    <div className="flex flex-col items-center text-center py-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Icon */}
      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-lg ${
        isMiniEval 
          ? 'bg-gradient-to-br from-amber-400 to-orange-500' 
          : 'bg-gradient-to-br from-blue-500 to-violet-600'
      }`}>
        {isMiniEval
          ? <ClipboardList className="w-10 h-10 text-white" />
          : <BookOpen className="w-10 h-10 text-white" />
        }
      </div>

      {/* Badge */}
      {isMiniEval && (
        <div className="bg-amber-500/20 text-amber-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-3 border border-amber-500/30">
          ⭐ Mini Evaluación del Módulo
        </div>
      )}

      {/* Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">{lesson.title}</h1>

      {/* Already completed badge */}
      {alreadyCompleted && previousScore !== undefined && (
        <div className="flex items-center gap-2 bg-green-500/20 text-green-300 text-sm px-4 py-2 rounded-full mb-4 border border-green-500/30">
          <CheckCircle2 className="w-4 h-4" />
          Completada — Tu mejor puntaje: {previousScore}%
        </div>
      )}

      {/* Explanation */}
      {lesson.explanation && (
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 mb-6 text-left border border-white/10 max-w-lg w-full">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">Explicación</span>
          </div>
          <p className="text-white/85 text-sm leading-relaxed">{lesson.explanation}</p>
        </div>
      )}

      {/* Info Row */}
      <div className="flex items-center gap-4 text-sm text-white/50 mb-8">
        <div className="flex items-center gap-1.5">
          <Star className="w-4 h-4 text-amber-400" />
          <span>{activitiesCount} actividades</span>
        </div>
        {isMiniEval ? (
          <div className="flex items-center gap-1.5">
            <span>Pasa con ≥80%</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span>~{Math.ceil(activitiesCount * 0.5)} min</span>
          </div>
        )}
      </div>

      {/* CTA */}
      <Button
        onClick={onStart}
        size="lg"
        className={`w-full max-w-sm h-14 text-base font-bold rounded-2xl shadow-lg transition-transform hover:scale-[1.02] ${
          isMiniEval
            ? 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white border-0'
            : 'bg-gradient-to-r from-blue-500 to-violet-600 hover:from-blue-600 hover:to-violet-700 text-white border-0'
        }`}
      >
        {alreadyCompleted ? '🔄 Repetir lección' : '🚀 Comenzar'}
      </Button>
    </div>
  );
}