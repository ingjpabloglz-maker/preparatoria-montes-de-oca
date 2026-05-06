import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Simula el paso del tiempo para un usuario comparando una "fecha simulada"
 * contra el expires_at real del usuario. NO modifica expires_at.
 * Solo actualiza blocked_due_to_time y level_start_date para la simulación.
 */
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

    const sa = base44.asServiceRole;

    // Obtener UserProgress del usuario
    const progressList = await sa.entities.UserProgress.filter({ user_email });
    const progress = progressList?.[0];

    if (!progress) {
      return Response.json({ error: 'No se encontró UserProgress para ese usuario' }, { status: 404 });
    }

    if (!progress.expires_at) {
      return Response.json({ error: 'El usuario no tiene expires_at. Ejecuta la migración primero.' }, { status: 400 });
    }

    // Simular el "ahora" desplazado en el futuro
    const simulatedNow = new Date();
    simulatedNow.setDate(simulatedNow.getDate() + days_offset);

    // Comparar la fecha simulada contra expires_at real — SIN modificar expires_at
    const expiresAt = new Date(progress.expires_at);
    const isBlocked = simulatedNow > expiresAt;
    const daysRemaining = Math.max(0, Math.ceil((expiresAt - simulatedNow) / (1000 * 60 * 60 * 24)));

    // Solo actualizar blocked_due_to_time (NO expires_at, NO level_start_date real)
    await sa.entities.UserProgress.update(progress.id, {
      blocked_due_to_time: isBlocked,
    });

    return Response.json({
      success: true,
      user_email,
      days_offset,
      real_expires_at: progress.expires_at,
      simulated_now: simulatedNow.toISOString(),
      current_level: progress.current_level || 1,
      days_remaining: daysRemaining,
      blocked_due_to_time: isBlocked,
      message: isBlocked
        ? `✅ Usuario bloqueado por tiempo. Simulado +${days_offset} días desde hoy supera expires_at.`
        : `ℹ️ Usuario NO bloqueado. Simulado +${days_offset} días desde hoy, restan ${daysRemaining} días para expirar.`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});