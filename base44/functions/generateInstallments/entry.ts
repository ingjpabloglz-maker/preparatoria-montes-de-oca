import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Genera las 4 colegiaturas de un nivel para un usuario.
 * Se llama automáticamente al iniciar un nivel (desde validateLevel1Folio y advanceToLevel).
 * Puede llamarse también por admin para migración.
 *
 * Parámetros:
 *   - user_email
 *   - level
 *   - level_start_date (ISO string)
 *   - mark_first_as_paid (boolean, default false) — para migración de usuarios existentes
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { user_email, level, level_start_date, mark_first_as_paid = false } = body;

    // Solo admin puede generar para otros usuarios
    if (user_email !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!user_email || !level || !level_start_date) {
      return Response.json({ error: 'Faltan parámetros: user_email, level, level_start_date' }, { status: 400 });
    }

    const sa = base44.asServiceRole;

    // Obtener duración del nivel desde LevelConfig
    const levelConfigs = await sa.entities.LevelConfig.filter({ level_number: level });
    const levelConfig = levelConfigs[0];
    if (!levelConfig?.time_limit_days) {
      return Response.json({ error: `LevelConfig no encontrado para nivel ${level}` }, { status: 500 });
    }

    const totalDays = levelConfig.time_limit_days;
    const intervalDays = Math.floor(totalDays / 4); // 25 días si totalDays=100

    // Eliminar colegiaturas previas del mismo nivel (re-generación limpia)
    const existing = await sa.entities.LevelPaymentPlan.filter({ user_email, level });
    for (const rec of existing) {
      await sa.entities.LevelPaymentPlan.delete(rec.id);
    }

    const startDate = new Date(level_start_date);
    const now = new Date();
    const created = [];

    for (let i = 0; i < 4; i++) {
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + i * intervalDays);

      const isFirstAndPaid = i === 0 && mark_first_as_paid;
      const isOverdue = !isFirstAndPaid && now > dueDate;

      const record = await sa.entities.LevelPaymentPlan.create({
        user_email,
        level,
        installment_number: i + 1,
        due_date: dueDate.toISOString(),
        paid_at: isFirstAndPaid ? now.toISOString() : null,
        status: isFirstAndPaid ? 'paid' : (isOverdue ? 'overdue' : 'pending'),
        folio_used: null,
        payment_id: null,
      });
      created.push(record);
    }

    return Response.json({
      success: true,
      level,
      user_email,
      installments_created: created.length,
      interval_days: intervalDays,
      installments: created,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});