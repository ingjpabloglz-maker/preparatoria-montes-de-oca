import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Endpoint para que docentes/admins revisen intentos manualmente
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Permitir: admin, docente (rol nuevo), teacher (compatibilidad)
  const allowedRoles = ['admin', 'docente', 'teacher'];
  if (!allowedRoles.includes(user.role)) {
    return Response.json({ error: 'Forbidden: exam.review permission required' }, { status: 403 });
  }

  const body = await req.json();
  const { attempt_id, score, passed, feedback } = body;

  if (!attempt_id || score === undefined || passed === undefined) {
    return Response.json({ error: 'attempt_id, score and passed are required' }, { status: 400 });
  }

  if (score < 0 || score > 100) {
    return Response.json({ error: 'score must be between 0 and 100' }, { status: 400 });
  }

  const reviewed_at = new Date().toISOString();

  // Obtener intento
  const attempts = await base44.asServiceRole.entities.EvaluationAttempt.filter({ id: attempt_id });
  if (!attempts[0]) {
    return Response.json({ error: 'Attempt not found' }, { status: 404 });
  }

  const attempt = attempts[0];

  // Actualizar EvaluationAttempt
  await base44.asServiceRole.entities.EvaluationAttempt.update(attempt_id, {
    score,
    passed,
    requires_manual_review: false,
    reviewed_by: user.email,
    reviewed_at,
    feedback: feedback || '',
  });

  // Actualizar LessonProgress para reflejar el resultado revisado
  const existingLP = await base44.asServiceRole.entities.LessonProgress.filter({
    user_email: attempt.user_email,
    lesson_id: attempt.lesson_id,
  });

  if (existingLP[0]) {
    await base44.asServiceRole.entities.LessonProgress.update(existingLP[0].id, {
      score,
      passed,
    });
  }

  return Response.json({
    status: 'ok',
    attempt_id,
    score,
    passed,
    reviewed_by: user.email,
    reviewed_at,
  });
});