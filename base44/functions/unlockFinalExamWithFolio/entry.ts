import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { folio, subject_id } = body;

  if (!folio || !subject_id) {
    return Response.json({ error: 'folio and subject_id are required' }, { status: 400 });
  }

  const user_email = user.email;

  // ─── 1. VERIFICAR QUE EL EXAMEN ESTÉ BLOQUEADO ───────────────────────────────
  const spArr = await base44.asServiceRole.entities.SubjectProgress.filter({ user_email, subject_id });
  const sp = spArr[0];

  if (!sp) {
    return Response.json({ error: 'No subject progress found' }, { status: 404 });
  }
  if (sp.test_passed) {
    return Response.json({ error: 'La materia ya fue aprobada' }, { status: 400 });
  }
  if ((sp.test_attempts || 0) < 3) {
    return Response.json({ error: 'Aún tienes intentos disponibles, no necesitas folio extraordinario' }, { status: 400 });
  }

  // ─── 2. VALIDAR FOLIO ─────────────────────────────────────────────────────────
  const results = await base44.asServiceRole.entities.Payment.filter({ folio: folio.trim().toUpperCase() });
  const record = results[0];

  if (!record) {
    return Response.json({ error: 'Folio no encontrado' }, { status: 404 });
  }
  if (record.folio_type !== 'extraordinary_test') {
    return Response.json({ error: 'Este folio no es válido para pruebas extraordinarias' }, { status: 400 });
  }
  if (record.status !== 'available') {
    return Response.json({ error: 'Este folio ya fue utilizado o está expirado' }, { status: 400 });
  }
  if (record.user_email && record.user_email !== user_email) {
    return Response.json({ error: 'Este folio está asignado a otro alumno' }, { status: 403 });
  }

  // ─── 3. MARCAR FOLIO COMO USADO ──────────────────────────────────────────────
  await base44.asServiceRole.entities.Payment.update(record.id, {
    status: 'used',
    user_email,
    used_date: new Date().toISOString(),
    subject_id,
  });

  // ─── 4. DESBLOQUEAR EXAMEN FINAL EN SubjectProgress ─────────────────────────
  await base44.asServiceRole.entities.SubjectProgress.update(sp.id, {
    test_attempts: 0,
    extraordinary_attempts_used: (sp.extraordinary_attempts_used || 0) + 1,
    final_exam_unlocked: true,
    last_activity: new Date().toISOString(),
  });

  return Response.json({
    status: 'ok',
    message: 'Folio validado. El examen final ha sido desbloqueado.',
    unlocked: true,
  });
});