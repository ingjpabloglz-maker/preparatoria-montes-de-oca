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

    return Response.json({
      has_access: true,
      current_level: currentLevel,
      reason: 'Acceso permitido.'
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});