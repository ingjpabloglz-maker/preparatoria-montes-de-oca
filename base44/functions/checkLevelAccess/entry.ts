import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user_email = user.email;
    const sa = base44.asServiceRole;

    // Obtener UserProgress
    const progressList = await base44.entities.UserProgress.filter({ user_email });
    const progress = progressList?.[0];

    if (!progress) {
      return Response.json({
        has_access: false,
        current_level: 1,
        reason: 'Sin progreso registrado. Debes activar tu nivel con un folio de pago.',
      });
    }

    const currentLevel = progress.current_level || 1;

    // Verificar pago de inscripción (folio level_advance) para el nivel actual
    const payments = await base44.entities.Payment.filter({ user_email });
    const hasValidPayment = payments.some(
      p => p.level === currentLevel && p.folio_type === 'level_advance' && p.status === 'used'
    );

    if (!hasValidPayment) {
      return Response.json({
        has_access: false,
        current_level: currentLevel,
        reason: 'Debes activar tu nivel con un folio de pago para acceder a esta función.',
      });
    }

    // ─── INTEGRIDAD: si expires_at es null, recalcular desde LevelConfig ────────
    let expiresAtStr = progress.expires_at;
    if (!expiresAtStr) {
      const levelConfigs = await sa.entities.LevelConfig.filter({ level_number: currentLevel });
      const levelConfig = levelConfigs[0];
      if (levelConfig?.time_limit_days && progress.level_start_date) {
        const startDate = new Date(progress.level_start_date);
        const recalculated = new Date(startDate);
        recalculated.setDate(recalculated.getDate() + levelConfig.time_limit_days);
        expiresAtStr = recalculated.toISOString();
        await sa.entities.UserProgress.update(progress.id, { expires_at: expiresAtStr });
      } else {
        return Response.json({
          has_access: false,
          current_level: currentLevel,
          reason: 'No se puede determinar la expiración del nivel. Contacta al administrador.',
        });
      }
    }

    // ─── VALIDACIÓN DE EXPIRACIÓN POR expires_at ─────────────────────────────
    const now = new Date();
    const isExpired = now > new Date(expiresAtStr);

    if (isExpired) {
      if (!progress.blocked_due_to_time) {
        await sa.entities.UserProgress.update(progress.id, { blocked_due_to_time: true });
      }
      return Response.json({
        has_access: false,
        current_level: currentLevel,
        blocked_due_to_time: true,
        expires_at: expiresAtStr,
        reason: 'El tiempo asignado para este nivel ha expirado.',
      });
    }

    // ─── VALIDACIÓN DE COLEGIATURAS VENCIDAS ─────────────────────────────────
    // Solo evaluar la colegiatura MÁS PRÓXIMA no pagada cuyo due_date < now.
    // Colegiaturas futuras NO bloquean.
    const installments = await sa.entities.LevelPaymentPlan.filter({ user_email, level: currentLevel });
    installments.sort((a, b) => a.installment_number - b.installment_number);

    // Encontrar la primera colegiatura activa (no pagada) en orden
    const activeUnpaid = installments.find(i => i.status !== 'paid');

    if (activeUnpaid) {
      const dueDate = new Date(activeUnpaid.due_date);
      const isPastDue = now > dueDate;

      if (isPastDue) {
        // Sincronizar estado a overdue si no lo estaba
        if (activeUnpaid.status !== 'overdue') {
          await sa.entities.LevelPaymentPlan.update(activeUnpaid.id, { status: 'overdue' });
        }

        // Bloquear acceso
        if (!progress.blocked_due_to_time) {
          await sa.entities.UserProgress.update(progress.id, { blocked_due_to_time: true });
        }

        return Response.json({
          has_access: false,
          current_level: currentLevel,
          blocked_due_to_installment: true,
          overdue_installment: activeUnpaid.installment_number,
          overdue_due_date: activeUnpaid.due_date,
          reason: `La colegiatura ${activeUnpaid.installment_number} venció el ${new Date(activeUnpaid.due_date).toLocaleDateString('es-MX')}. Paga para restablecer tu acceso.`,
        });
      }
    }

    // Desbloquear si estaba bloqueado por colegiatura y ya no hay bloqueo activo
    if (progress.blocked_due_to_time) {
      await sa.entities.UserProgress.update(progress.id, { blocked_due_to_time: false });
    }

    return Response.json({
      has_access: true,
      current_level: currentLevel,
      expires_at: expiresAtStr,
      current_installment: progress.current_installment ?? null,
      reason: 'Acceso permitido.',
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});