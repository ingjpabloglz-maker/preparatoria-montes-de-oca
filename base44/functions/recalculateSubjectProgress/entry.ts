// Función de migración: recalcula SubjectProgress.progress_percent
// para todos los usuarios desde LessonProgress (fuente de verdad).
// Solo ejecutable por admin.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    // Cargar todo en paralelo
    const [allSubjectProgress, allLessons, allLessonProgress] = await Promise.all([
      base44.asServiceRole.entities.SubjectProgress.list(),
      base44.asServiceRole.entities.CourseLesson.list(),
      base44.asServiceRole.entities.LessonProgress.list(),
    ]);

    // Indexar lecciones por subject_id para lookup rápido
    const lessonsBySubject = {};
    for (const lesson of allLessons) {
      if (!lessonsBySubject[lesson.subject_id]) lessonsBySubject[lesson.subject_id] = [];
      lessonsBySubject[lesson.subject_id].push(lesson);
    }

    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const sp of allSubjectProgress) {
      try {
        const { user_email, subject_id } = sp;
        if (!subject_id || !user_email) { skipped++; continue; }

        const subjectLessons = (lessonsBySubject[subject_id] || []).filter(l => !l.is_mini_eval);
        const totalCount = subjectLessons.length;
        if (totalCount === 0) { skipped++; continue; }

        const completedIds = new Set(subjectLessons.map(l => l.id));
        const completedCount = allLessonProgress.filter(
          lp => lp.user_email === user_email && lp.subject_id === subject_id &&
                lp.completed && completedIds.has(lp.lesson_id)
        ).length;

        const progress_percent = Math.round((completedCount / totalCount) * 100);

        // Solo actualizar si el valor cambió
        if (sp.progress_percent !== progress_percent) {
          await base44.asServiceRole.entities.SubjectProgress.update(sp.id, {
            progress_percent,
            last_activity: new Date().toISOString(),
          });
          updated++;
        } else {
          skipped++;
        }
      } catch (err) {
        errors.push({ id: sp.id, error: err.message });
      }
    }

    return Response.json({
      status: 'ok',
      total: allSubjectProgress.length,
      updated,
      skipped,
      errors,
    });
  } catch (err) {
    console.error('recalculateSubjectProgress error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});