import React from 'react';
import { Progress } from "@/components/ui/progress";
import { Flame, Star, Target } from "lucide-react";

export default function CourseProgressHeader({ overallProgress, completedLessons, totalLessons }) {
  const getMotivationalMessage = () => {
    if (overallProgress === 0) return "¡Empieza tu primer lección!";
    if (overallProgress < 25) return "¡Buen comienzo!";
    if (overallProgress < 50) return "¡Vas por buen camino!";
    if (overallProgress < 75) return "¡Más de la mitad!";
    if (overallProgress < 100) return "¡Casi terminas!";
    return "¡Materia completada!";
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <span className="font-semibold text-gray-700 text-sm">{getMotivationalMessage()}</span>
        </div>
        <span className="text-2xl font-bold text-blue-600">{overallProgress}%</span>
      </div>

      <Progress value={overallProgress} className="h-3 mb-3" />

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-green-500" />
          <span>{completedLessons} de {totalLessons} lecciones completadas</span>
        </div>
        {overallProgress > 0 && (
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="font-medium text-amber-600">En progreso</span>
          </div>
        )}
      </div>
    </div>
  );
}