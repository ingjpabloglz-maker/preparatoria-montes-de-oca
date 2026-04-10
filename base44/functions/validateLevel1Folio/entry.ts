import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { folio } = await req.json();
  if (!folio) return Response.json({ error: 'folio es requerido' }, { status: 400 });

  const sa = base44.asServiceRole;
  const results = await sa.entities.Payment.filter({ folio: folio.trim().toUpperCase() });
  const record = results[0];

  if (!record) return Response.json({ error: 'Folio no encontrado' }, { status: 404 });
  if (record.level !== 1) return Response.json({ error: 'Este folio no corresponde al Nivel 1' }, { status: 400 });
  if (record.folio_type !== 'level_advance') return Response.json({ error: 'Tipo de folio inválido para inscripción' }, { status: 400 });
  if (record.status === 'expired') return Response.json({ error: 'Folio expirado' }, { status: 400 });
  if (record.status === 'used') {
    // Verificar si fue usado por este mismo alumno (ya validado antes)
    if (record.user_email === user.email) {
      return Response.json({ status: 'ok', already_validated: true });
    }
    return Response.json({ error: 'Folio ya utilizado por otro alumno' }, { status: 400 });
  }
  if (record.user_email && record.user_email !== user.email) {
    return Response.json({ error: 'Este folio está asignado a otro alumno' }, { status: 403 });
  }

  // Marcar folio como usado
  await sa.entities.Payment.update(record.id, {
    status: 'used',
    user_email: user.email,
    student_name: user.full_name,
    used_date: new Date().toISOString(),
  });

  // Crear o actualizar UserProgress con nivel 1 desbloqueado
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

  return Response.json({ status: 'ok', message: 'Acceso desbloqueado. ¡Bienvenido!' });
});