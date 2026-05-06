import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Duración de cada nivel en días — fuente de verdad única
const LEVEL_DURATION_DAYS = 100;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { user_email, days_offset } = await req.json();

    if (!user_email || days_offset === undefined) {
      return Response.json({ error: 'Faltan parámetros: user_email y days_offset' }, { status: 400 });
    }

    // Obtener UserProgress del usuario
    const progressList = await base44.asServiceRole.entities.UserProgress.filter({ user_email });
    const progress = progressList?.[0];

    if (!progress) {
      return Response.json({ error: 'No se encontró UserProgress para ese usuario' }, { status: 404 });
    }

    // Calcular nueva level_start_date restando days_offset días desde hoy
    const simulatedStartDate = new Date();
    simulatedStartDate.setDate(simulatedStartDate.getDate() - days_offset);

    // Calcular expires_at basado en la nueva start_date + LEVEL_DURATION_DAYS
    const simulatedExpiresAt = new Date(simulatedStartDate);
    simulatedExpiresAt.setDate(simulatedExpiresAt.getDate() + LEVEL_DURATION_DAYS);

    const now = new Date();
    const isBlocked = now > simulatedExpiresAt;
    const daysRemaining = Math.max(0, Math.ceil((simulatedExpiresAt - now) / (1000 * 60 * 60 * 24)));

    // Actualizar UserProgress con ambos campos
    await base44.asServiceRole.entities.UserProgress.update(progress.id, {
      level_start_date: simulatedStartDate.toISOString(),
      expires_at: simulatedExpiresAt.toISOString(),
      blocked_due_to_time: isBlocked,
    });

    return Response.json({
      success: true,
      user_email,
      days_offset,
      simulated_start_date: simulatedStartDate.toISOString(),
      simulated_expires_at: simulatedExpiresAt.toISOString(),
      current_level: progress.current_level || 1,
      level_duration_days: LEVEL_DURATION_DAYS,
      days_remaining: daysRemaining,
      blocked_due_to_time: isBlocked,
      message: isBlocked
        ? `✅ Usuario bloqueado por tiempo. Simulados ${days_offset} días (límite: ${LEVEL_DURATION_DAYS}).`
        : `ℹ️ Usuario NO bloqueado. Simulados ${days_offset} días (límite: ${LEVEL_DURATION_DAYS}, restan ${daysRemaining}).`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});