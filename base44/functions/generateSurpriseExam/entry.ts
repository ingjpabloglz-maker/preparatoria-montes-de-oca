import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const user_email = user.email;

  // Verificar si ya hizo el examen hoy
  const gamArr = await base44.asServiceRole.entities.GamificationProfile.filter({ user_email });
  const gam = gamArr[0] || null;
  const today = new Date().toISOString().split('T')[0];

  if (gam?.last_surprise_exam_date_normalized === today) {
    return Response.json({ error: 'already_done_today' }, { status: 400 });
  }

  // Obtener lecciones completadas del usuario
  const lessonProgress = await base44.asServiceRole.entities.LessonProgress.filter({ user_email, completed: true });
  const completedLessonIds = lessonProgress.map(lp => lp.lesson_id);

  if (completedLessonIds.length === 0) {
    return Response.json({ error: 'no_completed_lessons' }, { status: 400 });
  }

  // Obtener actividades de esas lecciones
  const allActivities = [];
  // Obtener en lotes para no saturar
  const batchSize = 20;
  for (let i = 0; i < Math.min(completedLessonIds.length, batchSize); i++) {
    const acts = await base44.asServiceRole.entities.CourseActivity.filter({
      lesson_id: completedLessonIds[i]
    });
    allActivities.push(...acts);
  }

  // Filtrar preguntas ya respondidas
  const answeredIds = new Set(gam?.answered_surprise_questions_ids || []);
  const available = allActivities.filter(a => !answeredIds.has(a.id));

  // Si hay pocas sin responder, resetear el historial
  const pool = available.length >= 5 ? available : allActivities;

  // Mezclar y tomar 5
  const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 5);

  // Devolver sin la respuesta correcta
  const questions = shuffled.map(({ id, type, question, options, points, lesson_id }) => ({
    id, type, question, options, points: points || 10, lesson_id
  }));

  return Response.json({ questions, total: questions.length });
});