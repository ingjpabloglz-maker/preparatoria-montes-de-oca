import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SERVICE_ACCOUNT_RE = /^service\+|@no-reply\.base44\.com$|^bot\+|^automation\+|^system\+/i;
function requireStudentRole(user, fnName) {
  const email = user?.email || 'anonymous';
  const role = user?.role || 'none';
  if (!user || user.role !== 'user' || SERVICE_ACCOUNT_RE.test(email)) {
    console.log(JSON.stringify({ event: 'NON_STUDENT_OPERATION_BLOCKED', function: fnName, email, role, timestamp: new Date().toISOString() }));
    return Response.json({ status: 'ignored', message: 'Operación exclusiva para alumnos.', blocked_role: role }, { status: 403 });
  }
  return null;
}

/**
 * Paga una colegiatura usando un folio tipo 'installment'.
 * Solo se permite pagar la siguiente colegiatura pendiente/vencida en orden.
 * Protecciones: doble pago, folio duplicado, folio incorrecto.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Solo alumnos pueden pagar colegiaturas
    const blocked = requireStudentRole(user, 'payInstallment');
    if (blocked) return blocked;

    const body = await req.json();
    const { folio } = body;

    if (!folio || !folio.trim()) {
      return Response.json({ error: 'Folio requerido' }, { status: 400 });
    }

    const folioCode = folio.trim().toUpperCase();
    const sa = base44.asServiceRole;
    const user_email = user.email;

    // ─── 1. Obtener progreso del usuario ────────────────────────────────────────
    const progressList = await sa.entities.UserProgress.filter({ user_email });
    const progress = progressList[0];
    if (!progress) {
      return Response.json({ error: 'Sin progreso registrado' }, { status: 404 });
    }

    const level = progress.current_level || 1;

    // ─── 2. Verificar que el folio no haya sido ya usado en ALGUNA colegiatura ──
    const alreadyUsedInPlan = await sa.entities.LevelPaymentPlan.filter({ folio_used: folioCode });
    if (alreadyUsedInPlan.length > 0) {
      return Response.json({
        error: 'Este folio ya fue aplicado a una colegiatura. No puede reutilizarse.',
      }, { status: 400 });
    }

    // ─── 3. Validar el folio en Payment ─────────────────────────────────────────
    const folioResults = await sa.entities.Payment.filter({ folio: folioCode });
    const record = folioResults[0];

    if (!record) {
      return Response.json({ error: 'Folio inválido.' }, { status: 404 });
    }
    if (record.folio_type !== 'installment') {
      return Response.json({
        error: `Este folio es de tipo "${record.folio_type}" y no es válido para pago de colegiatura. Usa un folio tipo "installment".`,
      }, { status: 400 });
    }
    if (record.status !== 'available') {
      return Response.json({ error: 'Este folio ya fue utilizado o está expirado.' }, { status: 400 });
    }
    if (record.level && record.level !== level) {
      return Response.json({
        error: `Este folio es para Nivel ${record.level}, no para Nivel ${level}.`,
      }, { status: 400 });
    }
    if (record.user_email && record.user_email !== user_email) {
      return Response.json({ error: 'Este folio está asignado a otro alumno.' }, { status: 403 });
    }

    // ─── 4. Obtener colegiaturas y encontrar la siguiente a pagar ───────────────
    const installments = await sa.entities.LevelPaymentPlan.filter({ user_email, level });
    installments.sort((a, b) => a.installment_number - b.installment_number);

    const nextDue = installments.find(inst => inst.status !== 'paid');
    if (!nextDue) {
      return Response.json({
        error: 'Todas las colegiaturas de este nivel ya están pagadas.',
      }, { status: 400 });
    }

    // ─── 5. Protección contra doble pago: re-leer estado fresco antes de escribir
    const freshList = await sa.entities.LevelPaymentPlan.filter({ user_email, level });
    freshList.sort((a, b) => a.installment_number - b.installment_number);
    const freshTarget = freshList.find(i => i.id === nextDue.id);
    if (!freshTarget || freshTarget.status === 'paid') {
      return Response.json({
        error: 'Esta colegiatura ya fue pagada (posible doble envío). Recarga tu página.',
      }, { status: 409 });
    }

    // ─── 6. Re-verificar folio fresco antes de escribir ─────────────────────────
    const freshFolioList = await sa.entities.Payment.filter({ folio: folioCode });
    const freshFolio = freshFolioList[0];
    if (!freshFolio || freshFolio.status !== 'available') {
      return Response.json({
        error: 'El folio ya no está disponible (posible doble envío). Intenta de nuevo.',
      }, { status: 409 });
    }

    const now = new Date();

    // ─── 7. Marcar folio como usado ─────────────────────────────────────────────
    await sa.entities.Payment.update(record.id, {
      status: 'used',
      user_email,
      student_name: user.full_name || '',
      used_date: now.toISOString(),
    });

    // ─── 8. Marcar colegiatura como pagada ──────────────────────────────────────
    await sa.entities.LevelPaymentPlan.update(nextDue.id, {
      status: 'paid',
      paid_at: now.toISOString(),
      folio_used: folioCode,
      payment_id: record.id,
    });

    // ─── 9. Calcular nueva current_installment ──────────────────────────────────
    const updatedInstallments = await sa.entities.LevelPaymentPlan.filter({ user_email, level });
    updatedInstallments.sort((a, b) => a.installment_number - b.installment_number);
    const nextUnpaid = updatedInstallments.find(i => i.status !== 'paid');
    const newCurrentInstallment = nextUnpaid ? nextUnpaid.installment_number : null;

    // ─── 10. Desbloquear si ya no hay colegiaturas vencidas ─────────────────────
    const stillOverdue = updatedInstallments.some(i => i.status === 'overdue');
    const isTimeExpired = progress.expires_at && now > new Date(progress.expires_at);

    const progressUpdate = { current_installment: newCurrentInstallment };
    if (!stillOverdue && !isTimeExpired && progress.blocked_due_to_time) {
      progressUpdate.blocked_due_to_time = false;
    }
    await sa.entities.UserProgress.update(progress.id, progressUpdate);

    return Response.json({
      success: true,
      message: `Colegiatura ${nextDue.installment_number} pagada exitosamente.`,
      installment_number: nextDue.installment_number,
      next_installment: newCurrentInstallment,
      paid_at: now.toISOString(),
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});