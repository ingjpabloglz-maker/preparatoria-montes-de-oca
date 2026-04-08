import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Endpoint seguro para listar intentos - solo admin/teacher
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.role !== 'admin' && user.role !== 'teacher') {
    return Response.json({ error: 'Forbidden: admin or teacher role required' }, { status: 403 });
  }

  const body = await req.json();
  const {
    user_email,
    subject_id,
    lesson_id,
    type,
    requires_manual_review,
    limit = 50,
  } = body;

  // Construir filtro dinámico
  const filter = {};
  if (user_email) filter.user_email = user_email;
  if (subject_id) filter.subject_id = subject_id;
  if (lesson_id) filter.lesson_id = lesson_id;
  if (type) filter.type = type;
  if (requires_manual_review !== undefined) filter.requires_manual_review = requires_manual_review;

  const attempts = await base44.asServiceRole.entities.EvaluationAttempt.list('-submitted_at', limit);

  // Filtrar manualmente porque algunos campos pueden no soportar filter compuesto
  const filtered = attempts.filter(a => {
    if (user_email && a.user_email !== user_email) return false;
    if (subject_id && a.subject_id !== subject_id) return false;
    if (lesson_id && a.lesson_id !== lesson_id) return false;
    if (type && a.type !== type) return false;
    if (requires_manual_review !== undefined && a.requires_manual_review !== requires_manual_review) return false;
    return true;
  });

  return Response.json({ status: 'ok', attempts: filtered, total: filtered.length });
});