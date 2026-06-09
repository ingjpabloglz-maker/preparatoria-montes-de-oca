import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Envía recordatorios por email a alumnos cuya siguiente colegiatura
 * vence en menos de 7 días (ventana: 1 a 6 días, incluyendo hoy).
 * Solo envía una vez por colegiatura (verifica NotificationLog).
 * Respeta email_notifications_enabled del GamificationProfile.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const sa = base44.asServiceRole;

    const now = new Date();
    const in7Days = new Date(now);
    in7Days.setDate(in7Days.getDate() + 7);

    // Buscar todas las colegiaturas pending/overdue con due_date <= 7 días
    const plans = await sa.entities.LevelPaymentPlan.filter({ status: 'pending' });

    // Pre-cargar mapa de alumnos para evitar N queries por plan
    const allUsers = await sa.entities.User.list();
    const studentMap = new Map(allUsers.filter(u => u.role === 'user' && !(/^service\+|@no-reply\.base44\.com$|^bot\+/i.test(u.email))).map(u => [u.email, u]));

    let sent = 0;
    let skipped = 0;

    for (const plan of plans) {
      const dueDate = new Date(plan.due_date);
      const daysLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

      // Solo notificar si vence en 1-6 días (no vencidas, no futuras lejanas)
      if (daysLeft < 1 || daysLeft > 6) {
        skipped++;
        continue;
      }

      const user_email = plan.user_email;
      const notifKey = `installment_reminder_${plan.level}_${plan.installment_number}`;

      // Verificar si ya se envió este recordatorio específico
      const logs = await sa.entities.NotificationLog.filter({ user_email });
      const alreadySent = logs.some(l => l.template_id === notifKey);
      if (alreadySent) {
        skipped++;
        continue;
      }

      // Verificar que el alumno tenga notificaciones habilitadas
      const gamProfiles = await sa.entities.GamificationProfile.filter({ user_email });
      const gamProfile = gamProfiles[0];
      if (gamProfile?.email_notifications_enabled === false) {
        skipped++;
        continue;
      }

      // Verificar que sea alumno real (sin query extra — ya cargado en studentMap)
      if (!studentMap.has(user_email)) {
        console.log(JSON.stringify({ event: 'NON_STUDENT_OPERATION_BLOCKED', function: 'sendInstallmentReminders', email: user_email, timestamp: new Date().toISOString() }));
        skipped++; continue;
      }
      const userName = studentMap.get(user_email)?.full_name?.split(' ')[0] || 'Estudiante';

      const dueDateFormatted = dueDate.toLocaleDateString('es-MX', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });

      const subject = `⚠️ Tu colegiatura ${plan.installment_number} vence en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`;

      const body = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: white; margin: 0; font-size: 22px;">⚠️ Recordatorio de Colegiatura</h1>
          </div>

          <p style="color: #374151; font-size: 16px;">Hola <strong>${userName}</strong>,</p>

          <p style="color: #374151;">Te recordamos que tu <strong>Colegiatura ${plan.installment_number} del Nivel ${plan.level}</strong> vence próximamente:</p>

          <div style="background: #fef9c3; border: 1px solid #fde047; border-radius: 10px; padding: 16px; text-align: center; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #713f12;">📅 Fecha de vencimiento</p>
            <p style="margin: 6px 0 0; font-size: 20px; font-weight: bold; color: #92400e;">${dueDateFormatted}</p>
            <p style="margin: 6px 0 0; font-size: 14px; color: #b45309;">Quedan <strong>${daysLeft} día${daysLeft !== 1 ? 's' : ''}</strong></p>
          </div>

          <p style="color: #374151; font-size: 14px;">Para evitar el bloqueo de tu acceso a la plataforma, acude a la administración escolar y solicita tu folio de colegiatura antes de la fecha límite.</p>

          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 14px; margin: 16px 0; font-size: 13px; color: #0369a1;">
            💡 Una vez que tengas tu folio, puedes registrar tu pago directamente en <strong>Mi Perfil → Colegiaturas</strong>.
          </div>

          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; text-align: center;">
            Si ya realizaste el pago, ignora este mensaje.<br/>
            Para desactivar estos recordatorios, ve a Mi Perfil → Preferencias.
          </p>
        </div>
      `;

      await sa.integrations.Core.SendEmail({
        to: user_email,
        subject,
        body,
      });

      // Registrar en NotificationLog para no reenviar
      await sa.entities.NotificationLog.create({
        user_email,
        template_id: notifKey,
        sent_date: now.toISOString(),
        status: 'sent',
        cooldown_end_date: null,
        emails_sent_this_week: 1,
      });

      sent++;
    }

    return Response.json({ success: true, sent, skipped });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});