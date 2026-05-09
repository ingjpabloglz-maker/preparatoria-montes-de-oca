import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ─────────────────────────────────────────────────────────────────────────────
// getLessonActivities (anteriormente getOrCreateLessonActivities)
//
// ARQUITECTURA LIMPIA — Regla fundamental:
//   ADMIN IA  → genera contenido (generateSubjectCurriculum / generateLessonWithActivities)
//   ALUMNO    → solo consume contenido (esta función)
//
// Esta función NUNCA genera actividades. Solo las lee.
// Si una lección no tiene actividades, retorna lista vacía con flag no_activities=true.
// El frontend debe mostrar un error controlado, jamás autogenerar.
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { lesson_id } = body;
    if (!lesson_id) return Response.json({ error: 'lesson_id requerido' }, { status: 400 });

    // Solo lectura — sin generación
    const activities = await base44.asServiceRole.entities.CourseActivity.filter({ lesson_id }, 'order');

    if (activities.length === 0) {
      console.warn(`[LESSON_GUARD] Lesson ${lesson_id} has no activities. No generation triggered (student access).`);
      return Response.json({
        status: 'no_activities',
        no_activities: true,
        activities: [],
        activities_count: 0,
      });
    }

    return Response.json({
      status: 'ok',
      activities,
      activities_count: activities.length,
    });

  } catch (e) {
    console.error('getLessonActivities error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});