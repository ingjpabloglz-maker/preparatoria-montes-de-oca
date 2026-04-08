import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Solo admin puede certificar
  if (user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const { user_email } = body;

  if (!user_email) {
    return Response.json({ error: 'user_email is required' }, { status: 400 });
  }

  try {
    // Obtener UserProgress
    const upList = await base44.asServiceRole.entities.UserProgress.filter({ user_email });
    if (upList.length === 0) {
      return Response.json({ error: 'User progress not found' }, { status: 404 });
    }

    const up = upList[0];

    // Validar que esté egresado (completed)
    if (up.graduation_status !== 'completed') {
      return Response.json({
        error: 'INVALID_STATUS',
        message: `Student must be in 'completed' status. Current: ${up.graduation_status}`,
      }, { status: 400 });
    }

    // Validar que exista snapshot
    const snapshots = await base44.asServiceRole.entities.AcademicRecordSnapshot.filter({
      user_email,
    });
    if (snapshots.length === 0) {
      return Response.json({
        error: 'NO_SNAPSHOT',
        message: 'No academic record snapshot found',
      }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    // Actualizar UserProgress con certificación
    await base44.asServiceRole.entities.UserProgress.update(up.id, {
      graduation_status: 'certified',
      certificate_validated_by_school: true,
      certificate_validated_at: nowIso,
    });

    return Response.json({
      status: 'ok',
      user_email,
      graduation_status: 'certified',
      certificate_validated_at: nowIso,
      message: 'Student marked as certified by school',
    });
  } catch (e) {
    console.error('markStudentAsCertified error:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
});