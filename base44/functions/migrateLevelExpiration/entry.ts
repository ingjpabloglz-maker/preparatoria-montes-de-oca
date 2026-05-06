import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Migración de datos: calcula expires_at para todos los UserProgress existentes
 * usando level_start_date + LevelConfig.time_limit_days (por nivel).
 * También sincroniza blocked_due_to_time según la nueva lógica.
 *
 * Solo puede ejecutarse por un administrador.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const sa = base44.asServiceRole;

    // Cargar configuraciones de niveles — fuente de verdad de duración
    const levelConfigs = await sa.entities.LevelConfig.list();
    const getLevelDays = (levelNumber) => {
      const config = levelConfigs.find(c => c.level_number === levelNumber);
      return config?.time_limit_days || null;
    };

    const allProgress = await sa.entities.UserProgress.list();
    const now = new Date();
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    const details = [];

    for (const progress of allProgress) {
      if (!progress.level_start_date) {
        skipped++;
        details.push({ email: progress.user_email, status: 'skipped', reason: 'sin level_start_date' });
        continue;
      }

      const timeLimitDays = getLevelDays(progress.current_level || 1);
      if (!timeLimitDays) {
        skipped++;
        details.push({ email: progress.user_email, status: 'skipped', reason: `sin LevelConfig para nivel ${progress.current_level}` });
        continue;
      }

      const startDate = new Date(progress.level_start_date);
      const expiresAt = new Date(startDate);
      expiresAt.setDate(expiresAt.getDate() + timeLimitDays);

      const isExpired = now > expiresAt;

      try {
        await sa.entities.UserProgress.update(progress.id, {
          expires_at: expiresAt.toISOString(),
          blocked_due_to_time: isExpired,
        });

        migrated++;
        details.push({
          email: progress.user_email,
          level: progress.current_level,
          time_limit_days: timeLimitDays,
          level_start_date: progress.level_start_date,
          expires_at: expiresAt.toISOString(),
          blocked_due_to_time: isExpired,
          status: 'migrated',
        });
      } catch (err) {
        errors++;
        details.push({ email: progress.user_email, status: 'error', error: err.message });
      }
    }

    return Response.json({
      success: true,
      summary: { total: allProgress.length, migrated, skipped, errors },
      details,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});