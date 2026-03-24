import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

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

    // Obtener LevelConfig para verificar si excede el límite
    const currentLevel = progress.current_level || 1;
    const levelConfigs = await base44.asServiceRole.entities.LevelConfig.filter({ level_number: currentLevel });
    const levelConfig = levelConfigs?.[0];
    const timeLimitDays = levelConfig?.time_limit_days || 180;

    // Determinar si excede el límite
    const isBlocked = days_offset >= timeLimitDays;

    // Actualizar UserProgress
    await base44.asServiceRole.entities.UserProgress.update(progress.id, {
      level_start_date: simulatedStartDate.toISOString(),
      blocked_due_to_time: isBlocked
    });

    return Response.json({
      success: true,
      user_email,
      days_offset,
      simulated_start_date: simulatedStartDate.toISOString(),
      current_level: currentLevel,
      time_limit_days: timeLimitDays,
      days_remaining: Math.max(0, timeLimitDays - days_offset),
      blocked_due_to_time: isBlocked,
      message: isBlocked
        ? `✅ Usuario bloqueado por tiempo. Simulados ${days_offset} días (límite: ${timeLimitDays}).`
        : `ℹ️ Usuario NO bloqueado. Simulados ${days_offset} días (límite: ${timeLimitDays}, restan ${timeLimitDays - days_offset}).`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});