import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user_email = user.email;

    // Obtener UserProgress
    const progressList = await base44.entities.UserProgress.filter({ user_email });
    const progress = progressList?.[0];

    if (!progress) {
      return Response.json({
        has_access: false,
        current_level: 1,
        reason: 'Sin progreso registrado. Debes activar tu nivel con un folio de pago.'
      });
    }

    const currentLevel = progress.current_level || 1;

    // Verificar pago activo para el nivel actual
    const payments = await base44.entities.Payment.filter({ user_email });
    const hasValidPayment = payments.some(
      p => p.level === currentLevel && p.folio_type === 'level_advance' && p.status === 'used'
    );

    if (!hasValidPayment) {
      return Response.json({
        has_access: false,
        current_level: currentLevel,
        reason: 'Debes activar tu nivel con un folio de pago para acceder a esta función.'
      });
    }

    // ─── VALIDACIÓN DE EXPIRACIÓN POR expires_at ─────────────────────────────
    const now = new Date();
    let isExpired = false;

    if (progress.expires_at) {
      // Fuente de verdad: campo expires_at explícito
      isExpired = now > new Date(progress.expires_at);
    }

    if (isExpired && !progress.blocked_due_to_time) {
      // Actualizar estado en BD si aún no estaba marcado
      await base44.asServiceRole.entities.UserProgress.update(progress.id, {
        blocked_due_to_time: true,
      });
    }

    if (isExpired || progress.blocked_due_to_time) {
      return Response.json({
        has_access: false,
        current_level: currentLevel,
        blocked_due_to_time: true,
        expires_at: progress.expires_at,
        reason: 'El tiempo asignado para este nivel ha expirado.'
      });
    }

    return Response.json({
      has_access: true,
      current_level: currentLevel,
      expires_at: progress.expires_at,
      reason: 'Acceso permitido.'
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});