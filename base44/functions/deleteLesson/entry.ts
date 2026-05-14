import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { lesson_id } = await req.json();
    if (!lesson_id) return Response.json({ error: 'lesson_id requerido' }, { status: 400 });

    const sa = base44.asServiceRole;

    // Borrar todas las actividades de la lección
    const acts = await sa.entities.CourseActivity.filter({ lesson_id });
    for (const a of acts) {
      try { await sa.entities.CourseActivity.delete(a.id); } catch (_) {}
    }

    // Borrar la lección (ignorar si ya no existe)
    try { await sa.entities.CourseLesson.delete(lesson_id); } catch (_) {}

    return Response.json({ success: true, deleted_activities: acts.length });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});