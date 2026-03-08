import React, { useState } from 'react';
import { createPageUrl } from '@/utils';
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Lock, ChevronDown, ChevronUp, BookOpen, ClipboardList } from "lucide-react";
import ModulePath from './ModulePath';

const UNIT_COLORS = [
  { bg: 'bg-blue-600', light: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
  { bg: 'bg-violet-600', light: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700' },
  { bg: 'bg-emerald-600', light: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  { bg: 'bg-amber-500', light: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  { bg: 'bg-rose-600', light: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700' },
];

export default function UnitCard({
  unit, unitIndex, modules, lessons,
  lessonProgressList, isModuleUnlocked, isLessonUnlocked, subjectId
}) {
  const [expanded, setExpanded] = useState(unitIndex === 0);
  const color = UNIT_COLORS[unitIndex % UNIT_COLORS.length];

  // Calcular progreso de la unidad
  const unitLessons = lessons.filter(l => modules.some(m => m.id === l.module_id) && !l.is_mini_eval);
  const completedInUnit = unitLessons.filter(l => lessonProgressList.find(lp => lp.lesson_id === l.id && lp.completed)).length;
  const unitProgress = unitLessons.length > 0 ? Math.round((completedInUnit / unitLessons.length) * 100) : 0;
  const isUnitComplete = unitProgress === 100 && unitLessons.length > 0;

  // ¿Está la unidad desbloqueada? (la primera siempre, las demás si la anterior tiene al menos 1 módulo terminado)
  const isFirstUnit = unitIndex === 0;
  const isUnitUnlocked = isFirstUnit || unitProgress > 0 || completedInUnit > 0 ||
    (unitIndex > 0); // simplificamos: unidades siempre visibles, módulos bloquean internamente

  return (
    <div className={`rounded-2xl border ${color.border} overflow-hidden shadow-sm`}>
      {/* Unit Header */}
      <button
        className={`w-full text-left p-4 sm:p-5 ${color.light} flex items-center gap-3 transition-all`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-10 h-10 ${color.bg} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
          <span className="text-white font-bold text-sm">{unitIndex + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`font-bold text-gray-800 text-sm sm:text-base`}>{unit.title}</h3>
            {isUnitComplete && (
              <Badge className="bg-green-100 text-green-700 text-xs px-2 py-0.5">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Completada
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <Progress value={unitProgress} className="h-1.5 flex-1 max-w-32" />
            <span className={`text-xs font-medium ${color.text}`}>{unitProgress}%</span>
            <span className="text-xs text-gray-400">{modules.length} módulos</span>
          </div>
        </div>
        <div className={`${color.text} flex-shrink-0`}>
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {/* Modules Path */}
      {expanded && (
        <div className="bg-white p-4 sm:p-5 space-y-4">
          {modules.map((module, moduleIndex) => {
            const unlocked = isModuleUnlocked(module, moduleIndex, modules);
            const moduleLessons = lessons.filter(l => l.module_id === module.id);
            return (
              <ModulePath
                key={module.id}
                module={module}
                moduleIndex={moduleIndex}
                lessons={moduleLessons}
                lessonProgressList={lessonProgressList}
                isUnlocked={unlocked}
                isLessonUnlocked={isLessonUnlocked}
                color={color}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}