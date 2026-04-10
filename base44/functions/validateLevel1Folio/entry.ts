import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const folio_code = (body.folio || '').trim().toUpperCase();

  if (!folio_code) {
    return Response.json({ error: 'Folio requerido' }, { status: 400 });
  }

  const sa = base44.asServiceRole;

  // Buscar el folio en la entidad Payment
  const results = await sa.entities.Payment.filter({ folio: folio_code });
  const record = results[0];

  if (!record) {
    return Response.json({ error: 'Folio inválido. Verifica el código e intenta de nuevo.' }, { status: 404 });
  }

  // Validar tipo: solo level_advance
  if (record.folio_type !== 'level_advance') {
    return Response.json({ error: 'Este folio no es válido para inscripción de nivel.' }, { status: 400 });
  }

  // Validar nivel: debe ser nivel 1
  if (record.level !== 1) {
    return Response.json({ error: 'Este folio no corresponde al Nivel 1.' }, { status: 400 });
  }

  // Validar estado
  if (record.status === 'expired') {
    return Response.json({ error: 'Folio expirado. Contacta a la administración.' }, { status: 400 });
  }

  if (record.status === 'used') {
    // Si ya fue usado por este mismo alumno, simplemente confirmar acceso
    if (record.user_email === user.email) {
      return Response.json({ status: 'ok', already_validated: true });
    }
    return Response.json({ error: 'Este folio ya fue utilizado por otro alumno.' }, { status: 400 });
  }

  if (record.status !== 'available') {
    return Response.json({ error: 'Folio no disponible.' }, { status: 400 });
  }

  // Validar que el folio sea para este alumno (si está asignado)
  if (record.user_email && record.user_email !== user.email) {
    return Response.json({ error: 'Este folio está asignado a otro alumno.' }, { status: 403 });
  }

  // ─── MARCAR FOLIO COMO USADO ─────────────────────────────────────────────────
  await sa.entities.Payment.update(record.id, {
    status: 'used',
    user_email: user.email,
    student_name: user.full_name,
    used_date: new Date().toISOString(),
  });

  // ─── DESBLOQUEAR ACCESO EN UserProgress ──────────────────────────────────────
  const existingProgress = await sa.entities.UserProgress.filter({ user_email: user.email });
  if (existingProgress.length > 0) {
    await sa.entities.UserProgress.update(existingProgress[0].id, {
      current_level: 1,
      level_start_date: new Date().toISOString(),
      graduation_status: 'in_progress',
    });
  } else {
    await sa.entities.UserProgress.create({
      user_email: user.email,
      current_level: 1,
      level_start_date: new Date().toISOString(),
      graduation_status: 'in_progress',
      completed_subjects: [],
      test_scores: [],
    });
  }

  return Response.json({ status: 'ok', message: '¡Acceso desbloqueado! Bienvenido a la plataforma.' });
});