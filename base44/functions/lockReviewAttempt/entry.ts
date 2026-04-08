import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Endpoint para marcar un intento como "en revisión" por un docente (anti-colisión)
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  if (!['admin', 'docente'].includes(user.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { attempt_id } = body;
  if (!attempt_id) return Response.json({ error: 'attempt_id required' }, { status: 400 });

  const attempts = await base44.asServiceRole.entities.EvaluationAttempt.filter({ id: attempt_id });
  if (!attempts[0]) return Response.json({ error: 'Not found' }, { status: 404 });
  const attempt = attempts[0];

  const now = new Date();
  const LOCK_TIMEOUT_MINUTES = 15;

  // Verificar si ya está bloqueado por otro docente (y el lock no expiró)
  if (attempt.review_locked_by && attempt.review_locked_by !== user.id) {
    const lockedAt = new Date(attempt.review_locked_at);
    const minutesElapsed = (now - lockedAt) / 60000;
    if (minutesElapsed < LOCK_TIMEOUT_MINUTES) {
      return Response.json({
        error: 'ATTEMPT_LOCKED',
        message: `Este intento está siendo revisado por otro docente. Tiempo restante: ${Math.ceil(LOCK_TIMEOUT_MINUTES - minutesElapsed)} minutos.`,
        locked_by: attempt.review_locked_by,
      }, { status: 409 });
    }
  }

  const review_started_at = now.toISOString();

  // Establecer lock
  await base44.asServiceRole.entities.EvaluationAttempt.update(attempt_id, {
    review_locked_by: user.id,
    review_locked_at: review_started_at,
  });

  return Response.json({ status: 'ok', review_started_at, locked_by: user.id });
});