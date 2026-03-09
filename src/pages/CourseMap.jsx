import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Lock, BookOpen, Star, Zap, Target } from "lucide-react";
import UnitCard from '../components/course/UnitCard';
import CourseProgressHeader from '../components/course/CourseProgressHeader';

export default function CourseMap() {
  const urlParams = new URLSearchParams(window.location.search);
  const subjectId = urlParams.get('id');

  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
    };
    loadUser();
  }, []);

  const { data: subject } = useQuery({
    queryKey: ['subject', subjectId],
    queryFn: async () => {
      const subjects = await base44.entities.Subject.filter({ id: subjectId });
      return subjects[0];
    },
    enabled: !!subjectId,
    staleTime: 30 * 60 * 1000, // estático
    refetchOnWindowFocus: false,
  });

  const { data: units = [] } = useQuery({
    queryKey: ['courseUnits', subjectId],
    queryFn: () => base44.entities.CourseUnit.filter({ subject_id: subjectId }, 'order'),
    enabled: !!subjectId,
    staleTime: 30 * 60 * 1000, // estático
    refetchOnWindowFocus: false,
  });

  const { data: modules = [] } = useQuery({
    queryKey: ['courseModules', subjectId],
    queryFn: () => base44.entities.CourseModule.filter({ subject_id: subjectId }, 'order'),
    enabled: !!subjectId,
    staleTime: 30 * 60 * 1000, // estático
    refetchOnWindowFocus: false,
  });

  const { data: lessons = [] } = useQuery({
    queryKey: ['courseLessons', subjectId],
    queryFn: () => base44.entities.CourseLesson.filter({ subject_id: subjectId }, 'order'),
    enabled: !!subjectId,
    staleTime: 30 * 60 * 1000, // estático
    refetchOnWindowFocus: false,
  });

  const { data: lessonProgressList = [] } = useQuery({
    queryKey: ['lessonProgress', user?.email, subjectId],
    queryFn: () => base44.entities.LessonProgress.filter({ user_email: user?.email, subject_id: subjectId }),
    enabled: !!user?.email && !!subjectId,
    staleTime: 60 * 1000, // 1 min — progreso de lección actualiza frecuente
    refetchOnWindowFocus: false,
  });

  // Calcular progreso general
  const totalLessons = lessons.filter(l => !l.is_mini_eval).length;
  const completedLessons = lessonProgressList.filter(lp => lp.completed && !lessons.find(l => l.id === lp.lesson_id)?.is_mini_eval).length;
  const overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Determinar qué módulos están desbloqueados
  const isModuleUnlocked = (module, moduleIndex, unitModules) => {
    if (moduleIndex === 0) return true;
    const prevModule = unitModules[moduleIndex - 1];
    // El módulo anterior debe tener su mini evaluación aprobada
    const prevMiniEval = lessons.find(l => l.module_id === prevModule.id && l.is_mini_eval);
    if (!prevMiniEval) return true;
    const prevEvalProgress = lessonProgressList.find(lp => lp.lesson_id === prevMiniEval.id);
    return prevEvalProgress?.passed === true;
  };

  // Determinar si una lección está desbloqueada
  const isLessonUnlocked = (lesson, lessonIndex, moduleLessons) => {
    if (lessonIndex === 0) return true;
    const prevLesson = moduleLessons[lessonIndex - 1];
    const prevProgress = lessonProgressList.find(lp => lp.lesson_id === prevLesson.id);
    return prevProgress?.completed === true;
  };

  if (!subject) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Si no hay contenido aún
  if (units.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-4xl mx-auto p-6">
          <Button
            variant="ghost"
            className="mb-6 gap-2"
            onClick={() => window.location.href = createPageUrl(`Subject?id=${subjectId}`)}
          >
            <ArrowLeft className="w-4 h-4" /> Volver
          </Button>
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-10 h-10 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Contenido próximamente</h2>
            <p className="text-gray-500">Las lecciones de esta materia se cargarán pronto.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 pb-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.location.href = createPageUrl(`Subject?id=${subjectId}`)}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{subject.name}</h1>
            <p className="text-sm text-gray-500">Ruta de aprendizaje</p>
          </div>
        </div>

        {/* Progress Header */}
        <CourseProgressHeader
          subjectName={subject.name}
          overallProgress={overallProgress}
          completedLessons={completedLessons}
          totalLessons={totalLessons}
        />

        {/* Units */}
        <div className="mt-8 space-y-6">
          {units.map((unit, unitIndex) => {
            const unitModules = modules.filter(m => m.unit_id === unit.id);
            return (
              <UnitCard
                key={unit.id}
                unit={unit}
                unitIndex={unitIndex}
                modules={unitModules}
                lessons={lessons}
                lessonProgressList={lessonProgressList}
                isModuleUnlocked={isModuleUnlocked}
                isLessonUnlocked={isLessonUnlocked}
                subjectId={subjectId}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}