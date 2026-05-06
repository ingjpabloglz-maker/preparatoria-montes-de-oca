import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Avanza al alumno al siguiente nivel, calculando expires_at en el servidor
 * usando LevelConfig.time_limit_days. El frontend NO puede enviar fechas.
 *
 * Requisitos:
 *   - Usuario autenticado
 *   - levelNum = nivel destino
 *   - El folio ya fue validado y marcado como 'used' ANTES de llamar esta función
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const levelNum = parseInt(body.level_number);

    if (!levelNum || levelNum < 1 || levelNum > 6) {
      return Response.json({ error: 'Nivel inválido (1-6)' }, { status: 400 });
    }

    const sa = base44.asServiceRole;

    // ─── Verificar que el folio de este nivel esté marcado como 'used' ───────────
    const payments = await sa.entities.Payment.filter({ user_email: user.email });
    const hasValidPayment = payments.some(
      p => p.level === levelNum && p.folio_type === 'level_advance' && p.status === 'used'
    );
    if (!hasValidPayment) {
      return Response.json({ error: 'No se encontró folio válido para este nivel.' }, { status: 403 });
    }

    // ─── Obtener duración desde LevelConfig — única fuente de configuración ──────
    const levelConfigs = await sa.entities.LevelConfig.filter({ level_number: levelNum });
    const levelConfig = levelConfigs[0];
    if (!levelConfig?.time_limit_days) {
      return Response.json({ error: `LevelConfig no encontrado para nivel ${levelNum}. Contacta al administrador.` }, { status: 500 });
    }

    // ─── Calcular expires_at en el servidor (tiempo UTC del servidor) ─────────────
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + levelConfig.time_limit_days);

    const levelData = {
      current_level: levelNum,
      level_start_date: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      blocked_due_to_time: false,
    };

    const existingProgress = await sa.entities.UserProgress.filter({ user_email: user.email });
    if (existingProgress.length > 0) {
      await sa.entities.UserProgress.update(existingProgress[0].id, levelData);
    } else {
      await sa.entities.UserProgress.create({
        user_email: user.email,
        ...levelData,
        completed_subjects: [],
        test_scores: [],
        total_progress_percent: 0,
      });
    }

    return Response.json({
      status: 'ok',
      level: levelNum,
      expires_at: expiresAt.toISOString(),
      time_limit_days: levelConfig.time_limit_days,
      message: `Nivel ${levelNum} iniciado. Expira el ${expiresAt.toLocaleDateString('es-MX')}.`,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});