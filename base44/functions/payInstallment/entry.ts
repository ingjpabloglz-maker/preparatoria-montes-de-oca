import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Paga una colegiatura usando un folio tipo 'installment'.
 * Solo se permite pagar la siguiente colegiatura pendiente en orden.
 * NO modifica expires_at.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { folio } = body;

    if (!folio) {
      return Response.json({ error: 'Folio requerido' }, { status: 400 });
    }

    const sa = base44.asServiceRole;
    const user_email = user.email;

    // Obtener el progreso del usuario
    const progressList = await sa.entities.UserProgress.filter({ user_email });
    const progress = progressList[0];
    if (!progress) {
      return Response.json({ error: 'Sin progreso registrado' }, { status: 404 });
    }

    const level = progress.current_level || 1;

    // Obtener colegiaturas del nivel actual, ordenadas
    const installments = await sa.entities.LevelPaymentPlan.filter({ user_email, level });
    installments.sort((a, b) => a.installment_number - b.installment_number);

    // Encontrar la próxima colegiatura a pagar (la menor no pagada)
    const nextDue = installments.find(inst => inst.status !== 'paid');
    if (!nextDue) {
      return Response.json({ error: 'Todas las colegiaturas de este nivel ya están pagadas.' }, { status: 400 });
    }

    // Validar el folio
    const folioResults = await sa.entities.Payment.filter({ folio: folio.trim().toUpperCase() });
    const record = folioResults[0];

    if (!record) {
      return Response.json({ error: 'Folio inválido.' }, { status: 404 });
    }
    if (record.folio_type !== 'installment') {
      return Response.json({ error: 'Este folio no es válido para pago de colegiatura.' }, { status: 400 });
    }
    if (record.status !== 'available') {
      return Response.json({ error: 'Este folio ya fue utilizado o está expirado.' }, { status: 400 });
    }
    if (record.level && record.level !== level) {
      return Response.json({ error: `Este folio es para Nivel ${record.level}, no para Nivel ${level}.` }, { status: 400 });
    }
    if (record.user_email && record.user_email !== user_email) {
      return Response.json({ error: 'Este folio está asignado a otro alumno.' }, { status: 403 });
    }

    const now = new Date();

    // Marcar folio como usado
    await sa.entities.Payment.update(record.id, {
      status: 'used',
      user_email,
      used_date: now.toISOString(),
    });

    // Marcar colegiatura como pagada
    await sa.entities.LevelPaymentPlan.update(nextDue.id, {
      status: 'paid',
      paid_at: now.toISOString(),
      folio_used: folio.trim().toUpperCase(),
      payment_id: record.id,
    });

    // Si el usuario estaba bloqueado por colegiatura, desbloquear
    if (progress.blocked_due_to_time) {
      // Solo desbloquear si no está expirado por tiempo
      const isTimeExpired = progress.expires_at && now > new Date(progress.expires_at);
      if (!isTimeExpired) {
        await sa.entities.UserProgress.update(progress.id, {
          blocked_due_to_time: false,
        });
      }
    }

    return Response.json({
      success: true,
      message: `Colegiatura ${nextDue.installment_number} pagada exitosamente.`,
      installment_number: nextDue.installment_number,
      paid_at: now.toISOString(),
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});