import React from 'react';
import { Button } from "@/components/ui/button";
import { BookOpen, ClipboardList, CheckCircle2, Star, Zap, Info, Lightbulb, FlaskConical } from "lucide-react";

// ─── Renderizado de explanation estructurada ──────────────────────────────────

function StructuredExplanation({ explanation }) {
  // Retrocompatibilidad: si es string plano, mostrarlo directo
  if (typeof explanation === 'string') {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 mb-4 text-left border border-white/10 max-w-lg w-full">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">Explicación</span>
        </div>
        <p className="text-white/85 text-sm leading-relaxed whitespace-pre-line">{explanation}</p>
      </div>
    );
  }

  if (!explanation || typeof explanation !== 'object') return null;

  const { intro, key_points = [], examples = [], summary } = explanation;

  return (
    <div className="max-w-lg w-full space-y-3 mb-4 text-left">

      {/* Intro */}
      {intro && (
        <div className="bg-blue-500/15 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-blue-300 uppercase tracking-wide">Introducción</span>
          </div>
          <p className="text-white/90 text-sm leading-relaxed">{intro}</p>
        </div>
      )}

      {/* Key Points */}
      {key_points.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Lightbulb className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Conceptos clave</span>
          </div>
          {key_points.map((kp, i) => (
            <div key={i} className="bg-white/8 border border-white/10 rounded-xl p-4">
              <p className="text-sm font-semibold text-white/95 mb-1">{kp.title}</p>
              <p className="text-sm text-white/75 leading-relaxed mb-2">{kp.content}</p>
              {kp.example && (
                <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                  <span className="text-xs text-white/45 font-semibold uppercase tracking-wide">Ejemplo: </span>
                  <span className="text-xs text-white/80 font-mono">{kp.example}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ejemplos prácticos */}
      {examples.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <FlaskConical className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Ejemplos prácticos</span>
          </div>
          {examples.map((ex, i) => (
            <div key={i} className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4">
              <p className="text-sm text-white/85 mb-2">❓ {ex.question}</p>
              <div className="bg-emerald-500/15 rounded-lg px-3 py-2">
                <span className="text-xs text-emerald-300 font-semibold">✅ </span>
                <span className="text-sm text-emerald-200">{ex.solution}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resumen */}
      {summary && (
        <div className="bg-violet-500/15 border border-violet-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Star className="w-4 h-4 text-violet-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-violet-300 uppercase tracking-wide">Resumen</span>
          </div>
          <p className="text-white/85 text-sm leading-relaxed">{summary}</p>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

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

      {isMiniEval && (
        <div className="bg-amber-500/20 text-amber-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-3 border border-amber-500/30">
          ⭐ Mini Evaluación del Módulo
        </div>
      )}

      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">{lesson.title}</h1>

      {alreadyCompleted && previousScore !== undefined && (
        <div className="flex items-center gap-2 bg-green-500/20 text-green-300 text-sm px-4 py-2 rounded-full mb-4 border border-green-500/30">
          <CheckCircle2 className="w-4 h-4" />
          Completada — Tu mejor puntaje: {previousScore}%
        </div>
      )}

      {/* Explicación pregenerada (estructurada o legacy string) */}
      {lesson.explanation && !isMiniEval && (
        <StructuredExplanation explanation={lesson.explanation} />
      )}

      {/* Info */}
      <div className="flex items-center gap-4 text-sm text-white/50 mb-8">
        <div className="flex items-center gap-1.5">
          <Star className="w-4 h-4 text-amber-400" />
          <span>{activitiesCount} actividades</span>
        </div>
        {isMiniEval ? (
          <span>Pasa con ≥60%</span>
        ) : (
          <span>~{Math.ceil(activitiesCount * 0.5)} min</span>
        )}
      </div>

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