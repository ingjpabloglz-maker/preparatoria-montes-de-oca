// Hook que calcula el progreso REAL de una o varias materias
// leyendo LessonProgress (lecciones completadas) y CourseLesson (total de lecciones),
// igual que CourseMap. SubjectProgress.progress_percent NO se usa para el porcentaje
// ya que no se actualiza automáticamente al completar lecciones.

import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Para un único subject.
 * Devuelve { realProgress, completedLessons, totalLessons, isLoading }
 */
export function useSubjectRealProgress(userEmail, subjectId) {
  const { data: lessons = [], isLoading: loadingLessons } = useQuery({
    queryKey: ['courseLessons', subjectId],
    queryFn: () => base44.entities.CourseLesson.filter({ subject_id: subjectId }),
    enabled: !!subjectId,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: lessonProgress = [], isLoading: loadingProgress } = useQuery({
    queryKey: ['lessonProgress', userEmail, subjectId],
    queryFn: () => base44.entities.LessonProgress.filter({ user_email: userEmail, subject_id: subjectId }),
    enabled: !!userEmail && !!subjectId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const totalLessons = lessons.filter(l => !l.is_mini_eval).length;
  const completedLessons = lessonProgress.filter(
    lp => lp.completed && !lessons.find(l => l.id === lp.lesson_id)?.is_mini_eval
  ).length;
  const realProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return {
    realProgress,
    completedLessons,
    totalLessons,
    isLoading: loadingLessons || loadingProgress,
  };
}

/**
 * Para múltiples subjects (ej: dashboard, level).
 * Recibe userEmail y un array de subjectIds.
 * Devuelve un map: { [subjectId]: { realProgress, completedLessons, totalLessons } }
 */
export function useMultiSubjectProgress(userEmail, subjectIds = []) {
  // Cargar todas las lecciones de los subjects de este nivel
  const { data: allLessons = [], isLoading: loadingLessons } = useQuery({
    queryKey: ['allLessonsForSubjects', subjectIds.join(',')],
    queryFn: async () => {
      if (!subjectIds.length) return [];
      // Traer lecciones para cada subject en paralelo
      const results = await Promise.all(
        subjectIds.map(sid => base44.entities.CourseLesson.filter({ subject_id: sid }))
      );
      return results.flat();
    },
    enabled: !!userEmail && subjectIds.length > 0,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Cargar todo el lessonProgress del usuario para estos subjects
  const { data: allLessonProgress = [], isLoading: loadingProgress } = useQuery({
    queryKey: ['allLessonProgressForSubjects', userEmail, subjectIds.join(',')],
    queryFn: async () => {
      if (!subjectIds.length || !userEmail) return [];
      const results = await Promise.all(
        subjectIds.map(sid =>
          base44.entities.LessonProgress.filter({ user_email: userEmail, subject_id: sid })
        )
      );
      return results.flat();
    },
    enabled: !!userEmail && subjectIds.length > 0,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Construir el mapa de progreso por subjectId
  const progressMap = {};
  for (const sid of subjectIds) {
    const lessons = allLessons.filter(l => l.subject_id === sid && !l.is_mini_eval);
    const completed = allLessonProgress.filter(
      lp => lp.subject_id === sid && lp.completed &&
        !allLessons.find(l => l.id === lp.lesson_id)?.is_mini_eval
    ).length;
    const total = lessons.length;
    progressMap[sid] = {
      realProgress: total > 0 ? Math.round((completed / total) * 100) : 0,
      completedLessons: completed,
      totalLessons: total,
    };
  }

  return {
    progressMap,
    isLoading: loadingLessons || loadingProgress,
  };
}